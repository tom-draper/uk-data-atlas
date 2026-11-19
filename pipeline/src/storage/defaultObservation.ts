import type { DatabaseSync } from "node:sqlite";
import {
	MEASURE_PREFERENCES,
	TOTAL_MEMBER_CODES,
	type MeasurePreference,
} from "@uk-data-atlas/measures";

/**
 * The safe default view of the statistics tables: `measure_dimension`,
 * `quantity`, `series_preference` and `v_observation_default`. Written at
 * atlas assembly, after every series (published, converted and modelled) is
 * in, and read by anyone who wants one value per quantity, area and period
 * without choosing between datasets, methods and breakdowns by hand.
 *
 * - `measure_dimension` says how each dimension a measure's series use is
 *   read: a `breakdown` splits a total (the default is the total), a
 *   `qualifier` makes every member its own quantity (male and female life
 *   expectancy). The role follows from the data where it can: a breakdown has
 *   a root member coded total or all that one of the measure's series holds.
 *   Anything else is declared in `packages/measures/src/measurePreferences.ts`,
 *   and an undeclared one fails the build rather than being guessed.
 * - A quantity is a measure on one boundary release with one member of each
 *   qualifier dimension. Only series at the default of every breakdown
 *   dimension are candidates for one.
 * - `series_preference` ranks the candidates of a quantity: published before
 *   aggregated before modelled before converted, then, for a modelled series,
 *   open before share-alike, then the declared dataset order of the measure.
 *   A tie that is left holds values for the same area and period, so it fails
 *   the build and names the series. A tie between series that share no area
 *   and period is harmless and is ranked by series id.
 */

/** Lowest first. */
export const METHOD_ORDER = [
	"published",
	"aggregated",
	"modelled",
	"converted",
] as const;

export type SeriesMethod = (typeof METHOD_ORDER)[number];

export type DimensionRole = {
	measureId: number;
	dimensionId: number;
	role: "breakdown" | "qualifier";
	/** The member that is the total. NULL for a qualifier, or a breakdown whose total is the series with no member. */
	defaultMemberId: number | null;
};

export type MemberFact = {
	dimensionId: number;
	code: string;
	parentId: number | null;
};

export type SeriesFact = {
	id: number;
	key: string;
	measureId: number;
	releaseId: number;
	dataset: string;
	method: SeriesMethod;
	/** A modelled series under a ShareAlike licence. */
	shareAlike: boolean;
	/** dimension id to member id */
	members: ReadonlyMap<number, number>;
};

type Preferences = Readonly<Record<string, MeasurePreference>>;

const pairKey = (measureId: number, dimensionId: number) =>
	`${measureId}:${dimensionId}`;

/**
 * The role of each (measure, dimension) pair that a series holds. Declared
 * roles come first, then the rule. A pair with neither is a problem.
 */
export const deriveDimensionRoles = (input: {
	series: ReadonlyArray<Pick<SeriesFact, "measureId" | "members">>;
	measures: ReadonlyMap<number, string>;
	dimensions: ReadonlyMap<number, string>;
	members: ReadonlyMap<number, MemberFact>;
	preferences?: Preferences;
}): { roles: DimensionRole[]; problems: string[] } => {
	const preferences = input.preferences ?? MEASURE_PREFERENCES;
	const held = new Map<string, Set<number>>();
	for (const { measureId, members } of input.series)
		for (const [dimensionId, memberId] of members) {
			const key = pairKey(measureId, dimensionId);
			const set = held.get(key) ?? new Set<number>();
			set.add(memberId);
			held.set(key, set);
		}
	const memberByCode = new Map<string, number>();
	for (const [id, member] of input.members)
		memberByCode.set(`${member.dimensionId}\0${member.code}`, id);
	const roles: DimensionRole[] = [];
	const problems: string[] = [];
	const pairs = [...held.keys()]
		.map((key) => key.split(":").map(Number) as [number, number])
		.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
	for (const [measureId, dimensionId] of pairs) {
		const measure = input.measures.get(measureId) ?? String(measureId);
		const dimension =
			input.dimensions.get(dimensionId) ?? String(dimensionId);
		const declared = preferences[measure]?.dimensions?.[dimension];
		if (declared?.role === "qualifier") {
			roles.push({
				measureId,
				dimensionId,
				role: "qualifier",
				defaultMemberId: null,
			});
			continue;
		}
		if (declared?.role === "breakdown") {
			let defaultMemberId: number | null = null;
			if (declared.default !== undefined) {
				defaultMemberId =
					memberByCode.get(`${dimensionId}\0${declared.default}`) ??
					null;
				if (defaultMemberId === null) {
					problems.push(
						`${measure}/${dimension}: the declared default member ${declared.default} does not exist.`,
					);
					continue;
				}
			}
			roles.push({
				measureId,
				dimensionId,
				role: "breakdown",
				defaultMemberId,
			});
			continue;
		}
		const total = [...(held.get(pairKey(measureId, dimensionId)) ?? [])]
			.filter((memberId) => {
				const member = input.members.get(memberId);
				return (
					member !== undefined &&
					member.parentId === null &&
					(TOTAL_MEMBER_CODES as readonly string[]).includes(
						member.code,
					)
				);
			})
			.sort((a, b) => a - b)[0];
		if (total === undefined) {
			problems.push(
				`${measure}/${dimension}: no series holds a total member (a root coded ${TOTAL_MEMBER_CODES.join(" or ")}). Declare its role in packages/measures/src/measurePreferences.ts.`,
			);
			continue;
		}
		roles.push({
			measureId,
			dimensionId,
			role: "breakdown",
			defaultMemberId: total,
		});
	}
	return { roles, problems };
};

export type RankedQuantity = {
	key: string;
	measureId: number;
	releaseId: number;
	series: Array<{ seriesId: number; rank: number }>;
};

/**
 * Groups the series that are at the default of every breakdown into
 * quantities and ranks each group. `overlaps` says whether two series hold a
 * value for a common area and period: only called for series the rules leave
 * tied.
 */
export const rankSeries = (input: {
	series: readonly SeriesFact[];
	roles: readonly DimensionRole[];
	measures: ReadonlyMap<number, string>;
	dimensions: ReadonlyMap<number, string>;
	members: ReadonlyMap<number, MemberFact>;
	releases: ReadonlyMap<number, string>;
	overlaps: (a: number, b: number) => boolean;
	preferences?: Preferences;
}): { quantities: RankedQuantity[]; problems: string[] } => {
	const preferences = input.preferences ?? MEASURE_PREFERENCES;
	const roleOf = new Map(
		input.roles.map((role) => [
			pairKey(role.measureId, role.dimensionId),
			role,
		]),
	);
	const problems: string[] = [];
	type Candidate = {
		series: SeriesFact;
		quantity: string;
		order: readonly [number, number, number];
	};
	const groups = new Map<
		string,
		{ measureId: number; releaseId: number; candidates: Candidate[] }
	>();
	for (const series of input.series) {
		const measure =
			input.measures.get(series.measureId) ?? String(series.measureId);
		const qualifiers: string[] = [];
		let atDefault = true;
		for (const [dimensionId, memberId] of series.members) {
			const role = roleOf.get(pairKey(series.measureId, dimensionId));
			const dimension =
				input.dimensions.get(dimensionId) ?? String(dimensionId);
			if (role === undefined) {
				problems.push(
					`${series.key}: ${measure}/${dimension} has no measure_dimension row.`,
				);
				atDefault = false;
				break;
			}
			if (role.role === "breakdown") {
				if (role.defaultMemberId !== memberId) {
					atDefault = false;
					break;
				}
			} else
				qualifiers.push(
					`${dimension}=${input.members.get(memberId)?.code ?? memberId}`,
				);
		}
		if (!atDefault) continue;
		const quantity = [
			measure,
			input.releases.get(series.releaseId) ?? String(series.releaseId),
			...qualifiers.sort(),
		].join("/");
		const datasets = preferences[measure]?.datasets?.order ?? [];
		const position = datasets.indexOf(series.dataset);
		const group = groups.get(quantity) ?? {
			measureId: series.measureId,
			releaseId: series.releaseId,
			candidates: [],
		};
		group.candidates.push({
			series,
			quantity,
			order: [
				METHOD_ORDER.indexOf(series.method),
				series.shareAlike ? 1 : 0,
				position === -1 ? datasets.length : position,
			],
		});
		groups.set(quantity, group);
	}
	const quantities: RankedQuantity[] = [];
	for (const [key, group] of [...groups].sort((a, b) =>
		a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
	)) {
		const sorted = group.candidates.sort(
			(a, b) =>
				a.order[0] - b.order[0] ||
				a.order[1] - b.order[1] ||
				a.order[2] - b.order[2] ||
				a.series.id - b.series.id,
		);
		for (let start = 0; start < sorted.length;) {
			let end = start + 1;
			while (
				end < sorted.length &&
				sorted[end]!.order.join() === sorted[start]!.order.join()
			)
				end++;
			for (let i = start; i < end; i++)
				for (let j = i + 1; j < end; j++)
					if (
						input.overlaps(
							sorted[i]!.series.id,
							sorted[j]!.series.id,
						)
					)
						problems.push(
							`Tie in quantity ${key}: ${sorted[i]!.series.key} and ${sorted[j]!.series.key} (${sorted[i]!.series.method}, datasets ${sorted[i]!.series.dataset} and ${sorted[j]!.series.dataset}) hold values for the same area and period. Declare a dataset order for ${input.measures.get(group.measureId)} in packages/measures/src/measurePreferences.ts.`,
						);
			start = end;
		}
		quantities.push({
			key,
			measureId: group.measureId,
			releaseId: group.releaseId,
			series: sorted.map((candidate, index) => ({
				seriesId: candidate.series.id,
				rank: index + 1,
			})),
		});
	}
	return { quantities, problems };
};

const TABLES = `
CREATE TABLE measure_dimension (
	measure_id INTEGER NOT NULL REFERENCES measure(id),
	dimension_id INTEGER NOT NULL REFERENCES dimension(id),
	role TEXT NOT NULL CHECK (role IN ('breakdown', 'qualifier')),
	default_member_id INTEGER REFERENCES dimension_member(id),
	CHECK (role = 'breakdown' OR default_member_id IS NULL),
	PRIMARY KEY (measure_id, dimension_id)
) WITHOUT ROWID, STRICT;
CREATE TABLE quantity (
	id INTEGER NOT NULL,
	measure_id INTEGER NOT NULL REFERENCES measure(id),
	release_id INTEGER NOT NULL REFERENCES area_release(id),
	key TEXT NOT NULL UNIQUE,
	PRIMARY KEY (id)
) STRICT;
CREATE TABLE series_preference (
	series_id INTEGER NOT NULL REFERENCES series(id),
	quantity_id INTEGER NOT NULL REFERENCES quantity(id),
	rank INTEGER NOT NULL CHECK (rank >= 1),
	PRIMARY KEY (series_id),
	UNIQUE (quantity_id, rank)
) WITHOUT ROWID, STRICT;`;

/**
 * The columns of `v_observation`, then the series the value came from, the
 * quantity, and how many other series hold a row for the same quantity, area
 * and period. A series is passed over for an area and period only when it has
 * no observation row there: a row whose value is NULL (a suppressed or missing
 * figure with a status) is the answer, not a gap.
 *
 * The licence is a lookup, not a join: with `source` in the join list SQLite
 * (without ANALYZE statistics) scans it ahead of `series` and takes 18 times
 * as long to read one measure on one release.
 */
export const DEFAULT_OBSERVATION_VIEW = `
SELECT d.slug AS dataset, m.slug AS measure, m.unit,
  (SELECT group_concat(dim.slug || '=' || dm.code, '; ')
   FROM series_member sm JOIN dimension dim ON dim.id = sm.dimension_id
   JOIN dimension_member dm ON dm.id = sm.member_id
   WHERE sm.series_id = s.id) AS members,
  a.code AS area_code, coalesce(n.name, v.name) AS area_name,
  r.geography, r.release AS release, p.label AS period,
  o.value, o.lower, o.upper, c.code AS category, st.slug AS status,
  s.method, (SELECT src.licence FROM source src WHERE src.id = d.source_id) AS licence,
  s.id AS series_id, q.key AS quantity,
  (SELECT count(*) FROM series_preference other
   JOIN observation oo ON oo.series_id = other.series_id
     AND oo.area_version_id = o.area_version_id AND oo.period_id = o.period_id
   WHERE other.quantity_id = sp.quantity_id AND other.series_id <> sp.series_id) AS alternatives
FROM series_preference sp
JOIN quantity q ON q.id = sp.quantity_id
JOIN series s ON s.id = sp.series_id
JOIN observation o ON o.series_id = sp.series_id
JOIN dataset d ON d.id = s.dataset_id
JOIN measure m ON m.id = s.measure_id
JOIN area_version v ON v.id = o.area_version_id
JOIN area a ON a.id = v.area_id
JOIN area_release r ON r.id = s.release_id
JOIN period p ON p.id = o.period_id
JOIN status st ON st.id = o.status_id
LEFT JOIN dimension_member c ON c.id = o.category_id
LEFT JOIN dataset_area_name n ON n.dataset_id = d.id AND n.area_version_id = v.id
WHERE NOT EXISTS (
  SELECT 1 FROM series_preference better
  JOIN observation ob ON ob.series_id = better.series_id
    AND ob.area_version_id = o.area_version_id AND ob.period_id = o.period_id
  WHERE better.quantity_id = sp.quantity_id AND better.rank < sp.rank)`;

const tableExists = (database: DatabaseSync, name: string) =>
	database
		.prepare(
			"SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?",
		)
		.get(name) !== undefined;

const lines = (problems: readonly string[]) =>
	problems.length > 20
		? `${problems.slice(0, 20).join("\n")}\n... and ${problems.length - 20} more`
		: problems.join("\n");

export type DefaultObservationSummary = {
	roles: number;
	quantities: number;
	rankedSeries: number;
	/** Quantities with more than one series. */
	contested: number;
};

/**
 * Writes the default view tables and the view. Fails, naming what is wrong,
 * when a dimension has no role, a tie is left, or a measure with series has no
 * default series.
 */
export const writeDefaultObservation = (
	database: DatabaseSync,
	preferences: Preferences = MEASURE_PREFERENCES,
): DefaultObservationSummary => {
	const measures = new Map(
		(
			database.prepare("SELECT id, slug FROM measure").all() as Array<{
				id: number;
				slug: string;
			}>
		).map((row) => [row.id, row.slug]),
	);
	const dimensions = new Map(
		(
			database.prepare("SELECT id, slug FROM dimension").all() as Array<{
				id: number;
				slug: string;
			}>
		).map((row) => [row.id, row.slug]),
	);
	const members = new Map<number, MemberFact>();
	for (const row of database
		.prepare(
			"SELECT id, dimension_id, code, parent_id FROM dimension_member",
		)
		.all() as Array<{
		id: number;
		dimension_id: number;
		code: string;
		parent_id: number | null;
	}>)
		members.set(row.id, {
			dimensionId: row.dimension_id,
			code: row.code,
			parentId: row.parent_id,
		});
	const releases = new Map(
		(
			database
				.prepare("SELECT id, geography, release FROM area_release")
				.all() as Array<{
				id: number;
				geography: string;
				release: string;
			}>
		).map((row) => [row.id, `${row.geography}:${row.release}`]),
	);
	const shareAlike = tableExists(database, "series_model")
		? "coalesce((SELECT l.share_alike FROM series_model sm JOIN model m ON m.id = sm.model_id JOIN licence l ON l.id = m.licence_id WHERE sm.series_id = s.id), 0)"
		: "0";
	const series = new Map<
		number,
		SeriesFact & { members: Map<number, number> }
	>();
	for (const row of database
		.prepare(
			`SELECT s.id, s.key, s.measure_id, s.release_id, s.method, d.slug AS dataset, ${shareAlike} AS share_alike FROM series s JOIN dataset d ON d.id = s.dataset_id ORDER BY s.id`,
		)
		.all() as Array<{
		id: number;
		key: string;
		measure_id: number;
		release_id: number;
		method: SeriesMethod;
		dataset: string;
		share_alike: number;
	}>)
		series.set(row.id, {
			id: row.id,
			key: row.key,
			measureId: row.measure_id,
			releaseId: row.release_id,
			dataset: row.dataset,
			method: row.method,
			shareAlike: row.share_alike === 1,
			members: new Map(),
		});
	for (const row of database
		.prepare("SELECT series_id, dimension_id, member_id FROM series_member")
		.all() as Array<{
		series_id: number;
		dimension_id: number;
		member_id: number;
	}>)
		series.get(row.series_id)?.members.set(row.dimension_id, row.member_id);
	const all = [...series.values()];

	const derived = deriveDimensionRoles({
		series: all,
		measures,
		dimensions,
		members,
		preferences,
	});
	if (derived.problems.length > 0)
		throw new Error(
			`Dimensions without a role:\n${lines(derived.problems)}`,
		);
	const overlap = database.prepare(
		"SELECT 1 FROM observation a JOIN observation b ON b.series_id = ? AND b.area_version_id = a.area_version_id AND b.period_id = a.period_id WHERE a.series_id = ? LIMIT 1",
	);
	const ranked = rankSeries({
		series: all,
		roles: derived.roles,
		measures,
		dimensions,
		members,
		releases,
		overlaps: (a, b) => overlap.get(b, a) !== undefined,
		preferences,
	});
	if (ranked.problems.length > 0)
		throw new Error(`Default view ties:\n${lines(ranked.problems)}`);

	database.exec(TABLES);
	const addRole = database.prepare(
		"INSERT INTO measure_dimension (measure_id, dimension_id, role, default_member_id) VALUES (?, ?, ?, ?)",
	);
	for (const role of derived.roles)
		addRole.run(
			role.measureId,
			role.dimensionId,
			role.role,
			role.defaultMemberId,
		);
	const addQuantity = database.prepare(
		"INSERT INTO quantity (id, measure_id, release_id, key) VALUES (?, ?, ?, ?)",
	);
	const addPreference = database.prepare(
		"INSERT INTO series_preference (series_id, quantity_id, rank) VALUES (?, ?, ?)",
	);
	let rankedSeries = 0;
	let contested = 0;
	for (const [index, quantity] of ranked.quantities.entries()) {
		const id = index + 1;
		addQuantity.run(
			id,
			quantity.measureId,
			quantity.releaseId,
			quantity.key,
		);
		for (const { seriesId, rank } of quantity.series)
			addPreference.run(seriesId, id, rank);
		rankedSeries += quantity.series.length;
		if (quantity.series.length > 1) contested++;
	}

	const unroled = database
		.prepare(
			"SELECT DISTINCT m.slug AS measure, d.slug AS dimension FROM series s JOIN series_member sm ON sm.series_id = s.id JOIN measure m ON m.id = s.measure_id JOIN dimension d ON d.id = sm.dimension_id LEFT JOIN measure_dimension md ON md.measure_id = s.measure_id AND md.dimension_id = sm.dimension_id WHERE md.measure_id IS NULL",
		)
		.all() as Array<{ measure: string; dimension: string }>;
	if (unroled.length > 0)
		throw new Error(
			`Series use dimensions that have no measure_dimension row: ${unroled.map((row) => `${row.measure}/${row.dimension}`).join(", ")}`,
		);
	const noDefault = database
		.prepare(
			"SELECT m.slug FROM measure m WHERE EXISTS (SELECT 1 FROM series s WHERE s.measure_id = m.id) AND NOT EXISTS (SELECT 1 FROM series_preference sp JOIN series s ON s.id = sp.series_id WHERE s.measure_id = m.id) ORDER BY m.slug",
		)
		.all() as Array<{ slug: string }>;
	if (noDefault.length > 0)
		throw new Error(
			`Measures with series but no default series: ${noDefault.map((row) => row.slug).join(", ")}. Declare the breakdown's default in packages/measures/src/measurePreferences.ts.`,
		);

	database.exec(
		`CREATE VIEW v_observation_default AS${DEFAULT_OBSERVATION_VIEW}`,
	);
	// The tie rule makes this impossible by construction. Reading the whole
	// view (about 3 s) proves it on the data that ships.
	const repeated = database
		.prepare(
			"SELECT quantity, area_code, period, count(*) AS n FROM v_observation_default GROUP BY quantity, area_code, period HAVING n > 1 LIMIT 5",
		)
		.all() as Array<{
		quantity: string;
		area_code: string;
		period: string;
	}>;
	if (repeated.length > 0)
		throw new Error(
			`v_observation_default has more than one row for: ${repeated.map((row) => `${row.quantity} ${row.area_code} ${row.period}`).join("; ")}`,
		);
	return {
		roles: derived.roles.length,
		quantities: ranked.quantities.length,
		rankedSeries,
		contested,
	};
};
