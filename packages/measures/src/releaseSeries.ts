import type { SQLOutputValue, SqlReader } from "@uk-data-atlas/atlas-db";

/**
 * One area's series rebuilt on one boundary release.
 *
 * A measure published on several releases of its geography, or on another
 * geography, is held in `atlas.sqlite` as published series on each release
 * and, for the standard releases, as converted series the `converted-series`
 * stage moved onto them. This reads both for one area of one target release
 * and keeps one value per period: the target's own published value where
 * it has one, else the converted one. Each value names how it was made, and
 * each period with no value says why.
 *
 * Nothing is converted here. A value is either published on the target or
 * was converted at build time, under the rules and backtested error model of
 * `pipeline/src/conversion`. The only arithmetic is what the statistics
 * selector already does on published series: parts of a summed dimension
 * added, and a ratio taken from its numerator and denominator.
 */

/** The series of one quantity on one geography, as a statistics selector names it. */
export type ReleaseSeriesPart = {
	datasetId: string;
	measure: string;
	/** Members fixed on each dimension the series carries. */
	dimensions: Record<string, string>;
	geography: string;
	/** Dimensions whose parts are added, as population sums single years of age. */
	sum?: string[];
};

/**
 * What one value is, on every geography the dataset publishes it on. The
 * parts are the same quantity on different geographies, so a series on any
 * of them can have been converted onto the target.
 */
export type ReleaseSeriesSpec = {
	parts: ReleaseSeriesPart[];
	/**
	 * Divide by another quantity of the same dataset in the same area and
	 * period, as a vote share is votes over valid votes.
	 */
	ratio?: {
		parts: ReleaseSeriesPart[];
		scale: number;
		scaleQuotient?: true;
	};
	/**
	 * Read an area with no value as zero where the measure's other series
	 * hold the area in the period on the target. Applied to native periods
	 * alone: a converted series records its own gaps.
	 */
	absentAsZero?: true;
};

export type ReleaseValueMethod = "native" | "exact" | "weighted";

/** Where a converted value came from. Absent on a native one. */
export type ReleaseValueSource = {
	/** The release it was published on, such as `ward:2023-12-uk-bgc`. */
	release: string;
	/** `sum` where counts were added or split, `rebuild` where a ratio or mean was taken again from its converted parts. */
	rule: "sum" | "rebuild";
	/** The weight basis a split would use, such as `population`. */
	basis: string;
	/** The crosswalks of the route, in order. */
	crosswalks: string[];
	/** The share of the converted series' reached areas that hold a value. */
	seriesCoverage: number;
};

export type ReleaseValue = {
	periodId: number;
	period: string;
	value: number;
	/** The published status of a native value, else `derived` or `estimated`. */
	status: string;
	lower?: number;
	upper?: number;
	method: ReleaseValueMethod;
	/** The share of the value regrouped from whole source areas. 1 unless weighted. */
	exactShare: number;
	source?: ReleaseValueSource;
	/** Where the API took a ratio of the selector's numerator and denominator. */
	rebuiltRatio?: true;
	flags: ReleaseValueFlag[];
};

export type ReleaseValueFlag =
	/** A weighted value whose regrouped share is below `LOW_EXACT_SHARE`. */
	| "low-exact-share"
	/**
	 * The target area has no version on the source release: it was created
	 * since, often by a reorganisation, and its value is built from its
	 * predecessors' areas.
	 */
	| "area-not-on-source-release"
	/** The value's converted series covers less than `LOW_SERIES_COVERAGE` of the areas it reached. */
	| "low-series-coverage";

/** Why a period with a published source has no value on the target. */
export type ReleaseGapReason =
	/** The measure's conversion rule is `refuse`: a median, rank, index, category or a rate with no published parts. */
	| "refused-measure"
	/** No chain of crosswalks reaches the target from the source release. */
	| "no-route"
	/** A ratio or mean has no published numerator, denominator or weight to be rebuilt from. */
	| "missing-component"
	/** Every value of the source would be split, and the measure's split is not backtested. */
	| "no-values"
	/** A feeding source area has no value while others do. */
	| "missing-input"
	/** The value would be split, and a split of this measure is not backtested. */
	| "unmeasured-split"
	/** The crosswalk has no weight on the basis. */
	| "no-weight"
	/** A best-fit crosswalk straddles the area, so it is not carried. */
	| "best-fit-straddler"
	/** A rebuilt ratio's converted denominator is not above zero. */
	| "no-denominator"
	/** The source was converted, but none of its values reaches this area. */
	| "no-source-value"
	/** A rate is not taken from a numerator or denominator that was split by a weight. */
	| "split-ratio"
	/** The parts of a sum came from different source releases. */
	| "mixed-sources"
	/** Any other recorded reason, passed through as written. */
	| (string & {});

export type ReleaseGap = {
	periodId: number;
	period: string;
	/** The releases that publish the period, each with its reason. */
	sources: Array<{
		release: string;
		reason: ReleaseGapReason;
		note?: string;
	}>;
};

export type ReleaseSeries = {
	target: { geography: string; release: string };
	areaCode: string;
	areaName: string;
	values: ReleaseValue[];
	gaps: ReleaseGap[];
	/** The measure's conversion rule, as `measure_conversion` states it. */
	conversion?: { rule: string; reason: string | null };
};

/** Below this share of regrouped mass, a weighted value is flagged. */
export const LOW_EXACT_SHARE = 0.8;
/** Below this coverage, a converted series' values are flagged. */
export const LOW_SERIES_COVERAGE = 0.9;

/**
 * The releases that hold converted series: the standard ones, and every
 * release of the geographies population totals are converted onto.
 */
export const convertedReleases = (database: SqlReader) =>
	database
		.prepare(
			`SELECT r.geography, r.release FROM area_release r
			WHERE r.id IN (SELECT DISTINCT release_id FROM series WHERE method = 'converted')
			ORDER BY r.geography, r.release`,
		)
		.all()
		.map((row) => ({
			geography: String(row.geography),
			release: String(row.release),
		}));

type SeriesRow = {
	id: number;
	key: string;
	releaseId: number;
	release: string;
	/** Every member, as `dimension=code` sorted, for telling parts of a sum apart. */
	signature: string;
};

/** Published series a part names, by the same rule as the statistics selector. */
const publishedOf = (database: SqlReader, part: ReleaseSeriesPart) => {
	const rows = database
		.prepare(
			`SELECT s.id, s.key, s.release_id AS releaseId, r.geography || ':' || r.release AS release
			FROM series s JOIN dataset d ON d.id = s.dataset_id JOIN measure m ON m.id = s.measure_id
			JOIN area_release r ON r.id = s.release_id
			WHERE d.slug = ? AND m.slug = ? AND r.geography = ? AND s.method = 'published' ORDER BY s.id`,
		)
		.all(part.datasetId, part.measure, part.geography);
	const members = database.prepare(
		"SELECT d.slug AS dimension, m.code FROM series_member sm JOIN dimension d ON d.id = sm.dimension_id JOIN dimension_member m ON m.id = sm.member_id WHERE sm.series_id = ?",
	);
	const summed = new Set(part.sum ?? []);
	const kept: SeriesRow[] = [];
	for (const row of rows) {
		const id = Number(row.id);
		const held = new Map(
			members.all(id).map((m) => [String(m.dimension), String(m.code)]),
		);
		const fixed = Object.entries(part.dimensions).every(
			([dimension, code]) => held.get(dimension) === code,
		);
		const extra = [...held.keys()].some(
			(dimension) =>
				!(dimension in part.dimensions) && !summed.has(dimension),
		);
		if (!fixed || extra) continue;
		kept.push({
			id,
			key: String(row.key),
			releaseId: Number(row.releaseId),
			release: String(row.release),
			signature: [...held]
				.map(([dimension, code]) => `${dimension}=${code}`)
				.sort()
				.join(";"),
		});
	}
	return kept;
};

/** What one part signature holds for one period. */
type Cell =
	| {
			kind: "value";
			value: number;
			status: string;
			lower: number | null;
			upper: number | null;
			method: ReleaseValueMethod;
			estimated: number;
			converted?: number;
	  }
	| {
			kind: "gap";
			sources: Array<{ release: string; reason: string; note?: string }>;
	  };

const num = (value: SQLOutputValue) => (value === null ? null : Number(value));

/**
 * The periods a series holds, cached by series id for the life of the
 * database handle's generation.
 */
const periodCache = new WeakMap<object, Map<number, number[]>>();
const periodsOf = (database: SqlReader, cacheKey: object, series: number) => {
	let cache = periodCache.get(cacheKey);
	if (!cache) periodCache.set(cacheKey, (cache = new Map()));
	let periods = cache.get(series);
	if (!periods) {
		periods = database
			.prepare(
				"SELECT DISTINCT period_id AS id FROM observation WHERE series_id = ?",
			)
			.all(series)
			.map((row) => Number(row.id));
		cache.set(series, periods);
	}
	return periods;
};

type Quantity = {
	/** By period, then by part signature. */
	cells: Map<number, Map<string, Cell>>;
	converted: Set<number>;
};

/** Every value and gap the parts hold for the area on the target. */
const readQuantity = (
	database: SqlReader,
	cacheKey: object,
	parts: ReleaseSeriesPart[],
	target: { id: number; key: string },
	area: number,
): Quantity => {
	const seen = new Set<number>();
	const published: SeriesRow[] = [];
	for (const part of parts)
		for (const row of publishedOf(database, part))
			if (!seen.has(row.id)) {
				seen.add(row.id);
				published.push(row);
			}
	const cells = new Map<number, Map<string, Cell>>();
	const cellsOf = (period: number) => {
		let held = cells.get(period);
		if (!held) cells.set(period, (held = new Map()));
		return held;
	};
	/** A value beats a gap, and a native value beats a converted one. */
	const put = (period: number, signature: string, cell: Cell) => {
		const held = cellsOf(period);
		const current = held.get(signature);
		if (!current) return void held.set(signature, cell);
		if (current.kind === "value") {
			if (cell.kind === "value" && cell.method === "native")
				held.set(signature, cell);
			return;
		}
		if (cell.kind === "value") return void held.set(signature, cell);
		current.sources.push(...cell.sources);
	};
	const observations = database.prepare(
		`SELECT o.period_id AS period, o.value, st.slug AS status, o.lower, o.upper
		FROM observation o JOIN status st ON st.id = o.status_id
		WHERE o.series_id = ? AND o.area_version_id = ?`,
	);
	const estimates = database.prepare(
		"SELECT period_id AS period, estimated_share AS share FROM series_estimate WHERE series_id = ? AND area_version_id = ?",
	);
	const gaps = database.prepare(
		"SELECT period_id AS period, reason FROM series_gap WHERE series_id = ? AND area_version_id = ?",
	);
	const convertedSeries = database.prepare(
		"SELECT id FROM series WHERE key = ? AND method = 'converted' AND release_id = ?",
	);
	const skips = database.prepare(
		`SELECT k.reason, mc.reason AS note FROM conversion_skip k
		JOIN series s ON s.dataset_id = k.dataset_id AND s.measure_id = k.measure_id
			AND s.release_id = k.source_release_id AND s.method = 'published'
		LEFT JOIN measure_conversion mc ON mc.measure_id = k.measure_id AND k.reason = 'refused-measure'
		WHERE s.id = ? AND k.target_release_id = ? ORDER BY k.reason`,
	);
	const converted = new Set<number>();
	for (const series of published) {
		if (series.releaseId === target.id) {
			for (const row of observations.all(series.id, area)) {
				const value = num(row.value);
				if (value === null) continue;
				put(Number(row.period), series.signature, {
					kind: "value",
					value,
					status: String(row.status),
					lower: num(row.lower),
					upper: num(row.upper),
					method: "native",
					estimated: 0,
				});
			}
			continue;
		}
		const made = convertedSeries.get(
			`${series.key}~converted:${target.key}`,
			target.id,
		);
		const reached = new Set<number>();
		if (made) {
			const id = Number(made.id);
			converted.add(id);
			const shares = new Map(
				estimates
					.all(id, area)
					.map((row) => [Number(row.period), Number(row.share)]),
			);
			for (const row of observations.all(id, area)) {
				const value = num(row.value);
				if (value === null) continue;
				const period = Number(row.period);
				reached.add(period);
				const share = shares.get(period) ?? 0;
				put(period, series.signature, {
					kind: "value",
					value,
					status: String(row.status),
					lower: num(row.lower),
					upper: num(row.upper),
					method: row.status === "estimated" ? "weighted" : "exact",
					estimated: share * Math.abs(value),
					converted: id,
				});
			}
			for (const row of gaps.all(id, area)) {
				const period = Number(row.period);
				reached.add(period);
				put(period, series.signature, {
					kind: "gap",
					sources: [
						{ release: series.release, reason: String(row.reason) },
					],
				});
			}
		}
		// The periods the source holds that reached the area neither as a value
		// nor as a recorded gap.
		const left = periodsOf(database, cacheKey, series.id).filter(
			(period) => !reached.has(period),
		);
		if (left.length === 0) continue;
		const why = made
			? [{ release: series.release, reason: "no-source-value" }]
			: (() => {
					const rows = skips.all(series.id, target.id);
					return rows.length > 0
						? rows.map((row) => ({
								release: series.release,
								reason: String(row.reason),
								...(row.note === null
									? {}
									: { note: String(row.note) }),
							}))
						: [{ release: series.release, reason: "no-route" }];
				})();
		for (const period of left)
			put(period, series.signature, {
				kind: "gap",
				sources: why.map((w) => ({ ...w })),
			});
	}
	if (parts.some((part) => (part.sum ?? []).length > 0))
		readTotals(database, published, target, area, cells, converted);
	return { cells, converted };
};

/**
 * Where a release's parts of a sum were converted only as their total, as
 * population is on every release outside the standard ones, the total fills
 * each period the parts leave without a value. It is the converted series
 * whose added inputs are exactly the parts the spec names on that release, so
 * a total of other members never stands in. A native value is never replaced.
 */
const readTotals = (
	database: SqlReader,
	published: readonly SeriesRow[],
	target: { id: number; key: string },
	area: number,
	cells: Map<number, Map<string, Cell>>,
	converted: Set<number>,
) => {
	const byRelease = new Map<number, SeriesRow[]>();
	for (const series of published)
		if (series.releaseId !== target.id)
			byRelease.set(series.releaseId, [
				...(byRelease.get(series.releaseId) ?? []),
				series,
			]);
	const totalsOf = database.prepare(
		`SELECT s.id, group_concat(si.input_series_id) AS inputs FROM series s
		JOIN series_input si ON si.series_id = s.id AND si.role = 'value'
		WHERE s.method = 'converted' AND s.release_id = ?
			AND s.id IN (SELECT series_id FROM series_input WHERE input_series_id = ? AND role = 'value')
		GROUP BY s.id HAVING count(*) > 1`,
	);
	const observations = database.prepare(
		`SELECT o.period_id AS period, o.value, st.slug AS status, o.lower, o.upper,
			e.estimated_share AS share
		FROM observation o JOIN status st ON st.id = o.status_id
		LEFT JOIN series_estimate e ON e.series_id = o.series_id
			AND e.area_version_id = o.area_version_id AND e.period_id = o.period_id
		WHERE o.series_id = ? AND o.area_version_id = ?`,
	);
	const gaps = database.prepare(
		"SELECT period_id AS period, reason FROM series_gap WHERE series_id = ? AND area_version_id = ?",
	);
	for (const parts of byRelease.values()) {
		const ids = new Set(parts.map((series) => series.id));
		const total = totalsOf
			.all(target.id, parts[0]!.id)
			.map((row) => ({
				id: Number(row.id),
				inputs: String(row.inputs).split(",").map(Number),
			}))
			.find(
				(row) =>
					row.inputs.length === ids.size &&
					row.inputs.every((input) => ids.has(input)),
			);
		if (!total) continue;
		const fill = (period: number, cell: Cell) => {
			const held = cells.get(period);
			if (held && combine(held).kind === "value") return;
			cells.set(period, new Map([["", cell]]));
			if (cell.kind === "value") converted.add(total.id);
		};
		const release = parts[0]!.release;
		for (const row of observations.all(total.id, area)) {
			const value = num(row.value);
			if (value === null) continue;
			fill(Number(row.period), {
				kind: "value",
				value,
				status: String(row.status),
				lower: num(row.lower),
				upper: num(row.upper),
				method: row.status === "estimated" ? "weighted" : "exact",
				estimated: Number(row.share ?? 0) * Math.abs(value),
				converted: total.id,
			});
		}
		for (const row of gaps.all(total.id, area))
			fill(Number(row.period), {
				kind: "gap",
				sources: [{ release, reason: String(row.reason) }],
			});
	}
};

type Combined =
	| (Extract<Cell, { kind: "value" }> & { convertedIds: number[] })
	| Extract<Cell, { kind: "gap" }>;

const RANK: Record<ReleaseValueMethod, number> = {
	native: 0,
	exact: 1,
	weighted: 2,
};

/**
 * One period's parts as one cell: the value, or the sum of its parts where
 * every part holds one, else a gap that gives every part's reason.
 */
const combine = (parts: Map<string, Cell>): Combined => {
	// A member of a sum with no source value for the area, such as a party
	// that did not stand, is absent rather than missing, as it is when the
	// sum is read on the source release, while another member holds a value.
	const held = [...parts.values()];
	const absent = (cell: Cell) =>
		cell.kind === "gap" &&
		cell.sources.every((source) => source.reason === "no-source-value");
	const cells = held.some((cell) => cell.kind === "value")
		? held.filter((cell) => !absent(cell))
		: held;
	const gapped = cells.filter(
		(cell): cell is Extract<Cell, { kind: "gap" }> => cell.kind === "gap",
	);
	if (gapped.length > 0) {
		const sources = new Map<
			string,
			{ release: string; reason: string; note?: string }
		>();
		for (const cell of gapped)
			for (const source of cell.sources)
				sources.set(`${source.release}|${source.reason}`, source);
		// A source left to a better route says why only when nothing else does.
		const reasons = [...sources.values()];
		const told = reasons.filter(
			(source) => source.reason !== "better-route",
		);
		return { kind: "gap", sources: told.length > 0 ? told : reasons };
	}
	const values = cells as Array<Extract<Cell, { kind: "value" }>>;
	if (values.length === 1) {
		const [only] = values;
		return {
			...only!,
			convertedIds: only!.converted ? [only!.converted] : [],
		};
	}
	let value = 0;
	let lower = 0;
	let upper = 0;
	let bounded = false;
	let estimated = 0;
	let method: ReleaseValueMethod = "native";
	const statuses = new Set<string>();
	for (const cell of values) {
		value += cell.value;
		lower += cell.lower ?? cell.value;
		upper += cell.upper ?? cell.value;
		bounded ||= cell.lower !== null;
		estimated += cell.estimated;
		if (RANK[cell.method] > RANK[method]) method = cell.method;
		statuses.add(cell.status);
	}
	return {
		kind: "value",
		value,
		status:
			statuses.size === 1
				? [...statuses][0]!
				: method === "weighted"
					? "estimated"
					: "derived",
		lower: bounded ? lower : null,
		upper: bounded ? upper : null,
		method,
		estimated,
		convertedIds: values.flatMap((cell) =>
			cell.converted ? [cell.converted] : [],
		),
	};
};

type ConversionRow = {
	release: string;
	rule: "sum" | "rebuild";
	basis: string;
	coverage: number;
	crosswalks: string[];
	sourceReleaseId: number;
};

const conversionOf = (database: SqlReader, series: number): ConversionRow => {
	const row = database
		.prepare(
			`SELECT c.rule, c.basis_id AS basis, c.coverage, r.geography || ':' || r.release AS release, i.release_id AS sourceReleaseId
			FROM series_conversion c
			JOIN series_input si ON si.series_id = c.series_id AND si.role IN ('value', 'numerator')
			JOIN series i ON i.id = si.input_series_id AND i.method = 'published'
			JOIN area_release r ON r.id = i.release_id
			WHERE c.series_id = ?`,
		)
		.get(series);
	if (!row)
		throw new Error(`Converted series ${series} has no conversion row.`);
	const crosswalks = database
		.prepare(
			"SELECT x.slug FROM series_crosswalk sc JOIN crosswalk x ON x.id = sc.crosswalk_id WHERE sc.series_id = ? ORDER BY sc.position",
		)
		.all(series)
		.map((r) => String(r.slug));
	return {
		release: String(row.release),
		rule: row.rule === "rebuild" ? "rebuild" : "sum",
		basis: String(row.basis),
		coverage: Number(row.coverage),
		crosswalks,
		sourceReleaseId: Number(row.sourceReleaseId),
	};
};

/**
 * An area's series on a target release, or undefined where the release or
 * the area on it does not exist. `periodLabel` names a stored period as the
 * caller serves it, such as `2021` for `2021-census`.
 */
export const readReleaseSeries = (
	database: SqlReader,
	spec: ReleaseSeriesSpec,
	target: { geography: string; release: string },
	areaCode: string,
	periodLabel: (stored: string) => string = (stored) => stored,
	cacheKey: object = database,
): ReleaseSeries | undefined => {
	const release = database
		.prepare(
			"SELECT id FROM area_release WHERE geography = ? AND release = ?",
		)
		.get(target.geography, target.release);
	if (!release) return undefined;
	const targetRelease = {
		id: Number(release.id),
		key: `${target.geography}:${target.release}`,
	};
	const areaRow = database
		.prepare(
			"SELECT v.id, v.area_id AS areaId, v.name FROM area_version v JOIN area a ON a.id = v.area_id WHERE a.code = ? AND v.release_id = ?",
		)
		.get(areaCode, targetRelease.id);
	if (!areaRow) return undefined;
	const area = Number(areaRow.id);
	const areaId = Number(areaRow.areaId);
	const labels = new Map(
		database
			.prepare("SELECT id, label FROM period")
			.all()
			.map((row) => [Number(row.id), String(row.label)]),
	);
	const starts = new Map(
		database
			.prepare("SELECT id, start_date AS start FROM period")
			.all()
			.map((row) => [Number(row.id), String(row.start)]),
	);
	const value = readQuantity(
		database,
		cacheKey,
		spec.parts,
		targetRelease,
		area,
	);
	const denominator = spec.ratio
		? readQuantity(
				database,
				cacheKey,
				spec.ratio.parts,
				targetRelease,
				area,
			)
		: undefined;

	const conversions = new Map<number, ConversionRow>();
	const conversion = (id: number) => {
		let held = conversions.get(id);
		if (!held) conversions.set(id, (held = conversionOf(database, id)));
		return held;
	};
	const onSource = database.prepare(
		"SELECT 1 FROM area_version WHERE area_id = ? AND release_id = ?",
	);

	const values: ReleaseValue[] = [];
	const gaps: ReleaseGap[] = [];
	const periods = new Set([
		...value.cells.keys(),
		...(denominator?.cells.keys() ?? []),
	]);
	if (spec.absentAsZero) {
		// The periods the measure's other series hold the area in, on the target.
		const held = database
			.prepare(
				`SELECT DISTINCT o.period_id AS period FROM series s
				JOIN dataset d ON d.id = s.dataset_id JOIN measure m ON m.id = s.measure_id
				JOIN observation o ON o.series_id = s.id AND o.area_version_id = ?
				WHERE d.slug = ? AND m.slug = ? AND s.release_id = ? AND s.method = 'published'`,
			)
			.all(
				area,
				spec.parts[0]!.datasetId,
				spec.parts[0]!.measure,
				targetRelease.id,
			)
			.map((row) => Number(row.period));
		for (const period of held)
			if (!value.cells.has(period)) {
				value.cells.set(
					period,
					new Map([
						[
							"",
							{
								kind: "value",
								value: 0,
								status: "observed",
								lower: null,
								upper: null,
								method: "native",
								estimated: 0,
							},
						],
					]),
				);
				periods.add(period);
			}
	}
	const ordered = [...periods].sort(
		(a, b) =>
			(starts.get(a) ?? "").localeCompare(starts.get(b) ?? "") || a - b,
	);
	for (const periodId of ordered) {
		const period = periodLabel(labels.get(periodId) ?? String(periodId));
		const top = value.cells.get(periodId);
		const bottom = denominator?.cells.get(periodId);
		const gap = (sources: ReleaseGap["sources"]) =>
			gaps.push({ periodId, period, sources });
		if (!top || (denominator && !bottom)) {
			const other = top ?? bottom;
			const cell = other ? combine(other) : undefined;
			gap(
				cell?.kind === "gap"
					? cell.sources
					: [
							{
								release: targetRelease.key,
								reason: "missing-component",
							},
						],
			);
			continue;
		}
		let cell = combine(top);
		let rebuiltRatio = false;
		if (denominator && spec.ratio) {
			const under = combine(bottom!);
			if (cell.kind === "gap" || under.kind === "gap") {
				gap([
					...(cell.kind === "gap" ? cell.sources : []),
					...(under.kind === "gap" ? under.sources : []),
				]);
				continue;
			}
			if (cell.method === "weighted" || under.method === "weighted") {
				gap([{ release: targetRelease.key, reason: "split-ratio" }]);
				continue;
			}
			if (under.value <= 0) {
				gap([{ release: targetRelease.key, reason: "no-denominator" }]);
				continue;
			}
			const { scale, scaleQuotient } = spec.ratio;
			const method: ReleaseValueMethod =
				RANK[cell.method] >= RANK[under.method]
					? cell.method
					: under.method;
			cell = {
				...cell,
				value: scaleQuotient
					? (cell.value / under.value) * scale
					: (scale * cell.value) / under.value,
				lower: null,
				upper: null,
				status: method === "native" ? cell.status : "derived",
				method,
				estimated: 0,
				convertedIds: [...cell.convertedIds, ...under.convertedIds],
			};
			rebuiltRatio = method !== "native";
		}
		if (cell.kind === "gap") {
			gap(cell.sources);
			continue;
		}
		const sources = [...new Set(cell.convertedIds)].map(conversion);
		const releases = new Set(sources.map((s) => s.release));
		if (releases.size > 1) {
			gap(
				[...releases].map((release) => ({
					release,
					reason: "mixed-sources",
				})),
			);
			continue;
		}
		const exactShare =
			cell.method === "weighted" && cell.value !== 0
				? Math.max(
						0,
						Math.min(1, 1 - cell.estimated / Math.abs(cell.value)),
					)
				: cell.method === "weighted"
					? 0
					: 1;
		const flags: ReleaseValueFlag[] = [];
		let source: ReleaseValueSource | undefined;
		if (sources.length > 0) {
			const first = sources[0]!;
			source = {
				release: first.release,
				rule: sources.some((s) => s.rule === "rebuild")
					? "rebuild"
					: "sum",
				basis: first.basis,
				crosswalks: [...new Set(sources.flatMap((s) => s.crosswalks))],
				seriesCoverage: Math.min(...sources.map((s) => s.coverage)),
			};
			if (!onSource.get(areaId, first.sourceReleaseId))
				flags.push("area-not-on-source-release");
			if (source.seriesCoverage < LOW_SERIES_COVERAGE)
				flags.push("low-series-coverage");
		}
		if (cell.method === "weighted" && exactShare < LOW_EXACT_SHARE)
			flags.push("low-exact-share");
		values.push({
			periodId,
			period,
			value: cell.value,
			status: cell.status,
			...(cell.lower === null || cell.upper === null
				? {}
				: { lower: cell.lower, upper: cell.upper }),
			method: cell.method,
			exactShare,
			...(source ? { source } : {}),
			...(rebuiltRatio ? { rebuiltRatio: true as const } : {}),
			flags,
		});
	}
	const rule = database
		.prepare(
			`SELECT mc.rule, mc.reason FROM measure_conversion mc JOIN measure m ON m.id = mc.measure_id WHERE m.slug = ?`,
		)
		.get(spec.parts[0]!.measure);
	return {
		target,
		areaCode,
		areaName: String(areaRow.name),
		values,
		gaps,
		...(rule
			? {
					conversion: {
						rule: String(rule.rule),
						reason:
							rule.reason === null ? null : String(rule.reason),
					},
				}
			: {}),
	};
};
