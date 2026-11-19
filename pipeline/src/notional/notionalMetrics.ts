import type { DatabaseSync } from "node:sqlite";
import type { IdRegistries } from "../ids/idRegistries.ts";
import { notionalKey } from "./copyNotional.ts";
import { GENERAL_DAY, NEW_SEATS, OLD_SEATS } from "./inputs.ts";

/**
 * Election metrics on the 2024 seats from each notional model, after
 * `copyNotionalSeries` (roadmap task 47):
 *
 * - `valid-votes` and `majority` of the notional 2019 result, on 2019's
 *   period, derived from the published 2019 series.
 * - `party-vote-share-change`, the 2024 share of the valid votes less the
 *   notional 2019 share, in percentage points, on 2024's period, derived
 *   from the party's notional series, or its 2024 one for a party that did
 *   not stand in 2019.
 *
 * Swing between any two parties is half the difference of their changes, and
 * marginality is the majority over the valid votes, so neither is stored.
 * Turnout change needs a notional electorate, which is not made.
 *
 * Each value is exact where the seat is whole 2019 seats, and estimated with
 * bounds otherwise, see `METRIC_BOUND_FACTORS`.
 */

export const LATER_DAY = "2024-07-04";

/**
 * The Brexit Party renamed itself Reform UK in January 2021, so its 2019
 * votes are Reform's previous share.
 */
const SUCCESSOR: Record<string, string> = { brx: "ruk" };

export type Bounded = { value: number; lower: number; upper: number };

export type SeatMetrics = {
	validVotes: Bounded;
	majority: Bounded;
	/** By the party's 2024 code. */
	shareChange: Map<string, Bounded>;
};

/**
 * Each metric's bound is its factor times the seat's at-risk votes (the votes
 * of 2019 seats split between new seats), or for a share change, the at-risk
 * votes as a share of the notional valid votes. The factor is the 95th
 * percentile of the metric's error over that, in the changed seats, against
 * the published notionals (`benchmark.ts`), measured by hand and not stored.
 * Valid votes depend only on the residents split, so both methods share one.
 */
export const METRIC_BOUND_FACTORS: Record<string, MetricFactors> = {
	modelled: { validVotes: 0.19, majority: 0.1, shareChange: 0.031 },
	open: { validVotes: 0.19, majority: 0.1, shareChange: 0.036 },
};

export type MetricFactors = {
	validVotes: number;
	majority: number;
	shareChange: number;
};

export type NotionalParty = { value: number; atRisk: number };

const bounded = (value: number, spread: number, floor = -Infinity) => ({
	value,
	lower: Math.max(floor, value - spread),
	upper: value + spread,
});

/**
 * The metrics of one seat from its notional party votes and its 2024 party
 * votes and valid votes. A party that did not stand in 2019 has no doubt in
 * its previous share, so its change is held at its value.
 */
export const seatMetrics = (
	notional: ReadonlyMap<string, NotionalParty>,
	later: ReadonlyMap<string, number>,
	laterValid: number,
	factors: MetricFactors,
): SeatMetrics => {
	const parties = [...notional.values()];
	const total = parties.reduce((sum, party) => sum + party.value, 0);
	const atRisk = parties.reduce((sum, party) => sum + party.atRisk, 0);
	const validVotes = bounded(total, factors.validVotes * atRisk, 0);

	const ranked = parties.map((party) => party.value).sort((a, b) => b - a);
	if (ranked.length === 0)
		throw new Error("A notional seat has no party votes");
	const majority = bounded(
		ranked[0]! - (ranked[1] ?? 0),
		factors.majority * atRisk,
		0,
	);

	const before = new Map<string, number>();
	for (const [party, votes] of notional)
		before.set(SUCCESSOR[party] ?? party, votes.value);
	const spread = (factors.shareChange * 100 * atRisk) / total;
	const shareChange = new Map<string, Bounded>();
	for (const party of new Set([...before.keys(), ...later.keys()])) {
		const then = before.get(party);
		const change =
			(100 * (later.get(party) ?? 0)) / laterValid -
			(100 * (then ?? 0)) / total;
		shareChange.set(
			party,
			bounded(change, then === undefined ? 0 : spread),
		);
	}
	return { validVotes, majority, shareChange };
};

const publishedKey = (measure: string, release: string, party?: string) =>
	`general-election/${measure}/constituency:${release}${party ? `/party=${party}` : ""}`;

export const metricKey = (measure: "valid-votes" | "majority", model: string) =>
	`${publishedKey(measure, OLD_SEATS)}~${model}:constituency:${NEW_SEATS}`;

export const shareChangeKey = (party: string, model: string) =>
	`${publishedKey("party-vote-share-change", NEW_SEATS, party)}~${model}:constituency:${NEW_SEATS}`;

type Row = Bounded & {
	seat: string;
	party: string;
	status: string;
	at_risk: number;
};
type SourceSeries = { id: number; dataset_id: number; measure_id: number };

/**
 * Adds the metric series of every notional model. Returns how many series and
 * observations it added. Fails if a series it derives from is not held.
 */
export const copyNotionalMetrics = (
	database: DatabaseSync,
	ids: IdRegistries,
) => {
	const one = <T>(sql: string, ...params: (string | number)[]) =>
		database.prepare(sql).get(...params) as T | undefined;
	const required = <T>(what: string, found: T | undefined) => {
		if (found === undefined)
			throw new Error(
				`The notional metrics need ${what}: rebuild notional-elections`,
			);
		return found;
	};
	const findSeries = (key: string, method = "published") =>
		one<SourceSeries>(
			"SELECT id, dataset_id, measure_id FROM series WHERE key = ? AND method = ?",
			key,
			method,
		);
	const seriesOf = (key: string) =>
		required(`the series ${key}`, findSeries(key));
	const idOf = (sql: string, what: string, value: string) =>
		required(what, one<{ id: number }>(sql, value)).id;
	const release = idOf(
		"SELECT id FROM area_releases WHERE geography = 'constituency' AND release = ?",
		"the 2024 seats",
		NEW_SEATS,
	);
	const earlier = idOf(
		"SELECT id FROM period WHERE label = ?",
		"the 2019 period",
		GENERAL_DAY,
	);
	const later = idOf(
		"SELECT id FROM period WHERE label = ?",
		"the 2024 period",
		LATER_DAY,
	);
	const changeMeasure = idOf(
		"SELECT id FROM measure WHERE slug = ?",
		"the change measure",
		"party-vote-share-change",
	);

	// 2024 results by seat, from the published series.
	const laterVotes = new Map<string, Map<string, number>>();
	const laterSeries = new Map<string, number>();
	for (const row of database
		.prepare(
			`SELECT s.id, a.code AS seat, o.value, dm.code AS party
			FROM series s
			JOIN series_member sm ON sm.series_id = s.id
			JOIN dimension_member dm ON dm.id = sm.member_id
			JOIN observation o ON o.series_id = s.id AND o.period_id = ?
			JOIN area_version v ON v.id = o.area_version_id
			JOIN area a ON a.id = v.area_id
			WHERE s.method = 'published' AND s.key LIKE ? AND o.value IS NOT NULL`,
		)
		.all(later, `${publishedKey("party-votes", NEW_SEATS)}/party=%`) as {
		id: number;
		seat: string;
		value: number;
		party: string;
	}[]) {
		laterSeries.set(row.party, row.id);
		let seat = laterVotes.get(row.seat);
		if (!seat) laterVotes.set(row.seat, (seat = new Map()));
		seat.set(row.party, row.value);
	}
	const laterValid = new Map(
		(
			database
				.prepare(
					`SELECT a.code AS seat, o.value FROM observation o
				JOIN area_version v ON v.id = o.area_version_id
				JOIN area a ON a.id = v.area_id
				WHERE o.series_id = ? AND o.period_id = ?`,
				)
				.all(
					seriesOf(publishedKey("valid-votes", NEW_SEATS)).id,
					later,
				) as { seat: string; value: number }[]
		).map((row) => [row.seat, row.value]),
	);
	const versions = new Map(
		(
			database
				.prepare(
					`SELECT a.code AS seat, v.id FROM area_version v
				JOIN area a ON a.id = v.area_id WHERE v.release_id = ?`,
				)
				.all(release) as { seat: string; id: number }[]
		).map((row) => [row.seat, row.id]),
	);

	const insertSeries = database.prepare(
		"INSERT INTO series (id, dataset_id, measure_id, release_id, method, derived_from_id, key) VALUES (?, ?, ?, ?, 'modelled', ?, ?)",
	);
	const insertMembers = database.prepare(
		"INSERT INTO series_member (series_id, dimension_id, member_id) SELECT ?, dimension_id, member_id FROM series_member WHERE series_id = ?",
	);
	const insertSeriesModel = database.prepare(
		"INSERT INTO series_model VALUES (?, ?)",
	);
	const insertObservation = database.prepare(
		"INSERT INTO observation (series_id, area_version_id, period_id, value, status_id, lower, upper) VALUES (?, ?, ?, ?, ?, ?, ?)",
	);
	const estimates = database.prepare(
		"SELECT seat, party, value, lower, upper, status, at_risk FROM notional_component.notional_estimate WHERE method = ? ORDER BY seat, party",
	);

	let series = 0;
	let observations = 0;
	const addSeries = (
		key: string,
		model: string,
		source: SourceSeries,
		measure: number,
		members?: number,
	) => {
		const id = ids.series.assign(key);
		insertSeries.run(
			id,
			source.dataset_id,
			measure,
			release,
			source.id,
			key,
		);
		if (members !== undefined) insertMembers.run(id, members);
		insertSeriesModel.run(id, model);
		series += 1;
		return id;
	};
	// Derived (6) values are exact, so carry no bounds; estimated (2) ones do.
	const observe = (
		seriesId: number,
		version: number,
		period: number,
		exact: boolean,
		bounded: Bounded,
	) => {
		insertObservation.run(
			seriesId,
			version,
			period,
			bounded.value,
			exact ? 6 : 2,
			exact ? null : bounded.lower,
			exact ? null : bounded.upper,
		);
		observations += 1;
	};

	for (const { method, model } of database
		.prepare(
			"SELECT method, model FROM notional_component.notional_model ORDER BY model",
		)
		.all() as { method: string; model: string }[]) {
		const factors = required(
			`the metric bound factors of ${method}`,
			METRIC_BOUND_FACTORS[method],
		);
		const bySeat = new Map<string, Row[]>();
		for (const row of estimates.all(method) as Row[]) {
			let seat = bySeat.get(row.seat);
			if (!seat) bySeat.set(row.seat, (seat = []));
			seat.push(row);
		}
		const scalar = Object.fromEntries(
			(["valid-votes", "majority"] as const).map((measure) => {
				const source = seriesOf(publishedKey(measure, OLD_SEATS));
				return [
					measure,
					addSeries(
						metricKey(measure, model),
						model,
						source,
						source.measure_id,
					),
				];
			}),
		) as Record<"valid-votes" | "majority", number>;
		const changeSeries = new Map<string, number>();
		const changeOf = (party: string) => {
			let id = changeSeries.get(party);
			if (id !== undefined) return id;
			const earlierParty =
				Object.entries(SUCCESSOR).find(
					([, successor]) => successor === party,
				)?.[0] ?? party;
			const members = required(
				`a 2024 series of ${party}`,
				laterSeries.get(party),
			);
			id = addSeries(
				shareChangeKey(party, model),
				model,
				findSeries(notionalKey(earlierParty, model), "modelled") ??
					seriesOf(publishedKey("party-votes", NEW_SEATS, party)),
				changeMeasure,
				members,
			);
			changeSeries.set(party, id);
			return id;
		};

		for (const [seat, rows] of bySeat) {
			const version = required(
				`the 2024 seat ${seat}`,
				versions.get(seat),
			);
			const exact = rows.every((row) => row.status === "derived");
			const metrics = seatMetrics(
				new Map(
					rows.map((row) => [
						row.party,
						{ value: row.value, atRisk: row.at_risk },
					]),
				),
				laterVotes.get(seat) ?? new Map(),
				required(`2024 valid votes in ${seat}`, laterValid.get(seat)),
				factors,
			);
			observe(
				scalar["valid-votes"],
				version,
				earlier,
				exact,
				metrics.validVotes,
			);
			observe(scalar.majority, version, earlier, exact, metrics.majority);
			for (const [party, change] of metrics.shareChange)
				observe(changeOf(party), version, later, exact, change);
		}
	}
	return { series, observations };
};
