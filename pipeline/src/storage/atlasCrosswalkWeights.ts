import type { DatabaseSync } from "node:sqlite";

/**
 * Crosswalk weights from the smallest held units: postcodes.
 *
 * A crosswalk compiled from polygon overlap or from a publisher lookup says
 * which areas relate, not how many people sit in each pair. A postcode is a
 * point about fifteen households wide, already placed in 29 releases of areas
 * (`postcode_area_set`), so for any crosswalk whose two releases are both
 * placed, the postcodes lying in both areas of a pair measure that pair. Three
 * bases are stored per edge:
 *
 * - `postcodes`: live small-user postcodes (large users are organisations, not
 *   homes), which needs no population input at all;
 * - `population`: usual residents, from the Census 2021 count of each LSOA (or
 *   the SIMD 2017 estimate of each Scottish data zone), shared equally between
 *   the live small-user postcodes inside that unit;
 * - `households`: the same, from the Census 2021 household count.
 *
 * Output-area census counts are not held, and no dwelling count is held at any
 * level, so there is no `dwellings` basis. Northern Ireland postcodes are not
 * held. A unit with a count but no live postcode keeps that count out of every
 * pair, which `WeightSummary.units` reports.
 *
 * Weights go on the edges a crosswalk already has and never add an edge: a
 * best-fit ward sits in one constituency whatever its postcodes say. For each
 * edge, per basis:
 *
 * - `overlap` is the measure inside both areas;
 * - `weight` is the overlap as a share of the overlaps of the source's edges,
 *   so a source's weights sum to 1;
 * - `source_share` and `target_share` are the overlap as a share of the whole
 *   source and the whole target, whichever edges they have, so a best-fit edge
 *   with a weight of 1 still shows how much of the source it holds.
 *
 * An edge whose pair holds no measure has no row for that basis. Identity
 * crosswalks (`extent-continuity`) are left alone: their weight is one by
 * definition. A crosswalk's own basis (`area`, or `population` where it was
 * compiled from census blocks) is never replaced.
 *
 * Everything is SQL over the stored sets, so no crosswalk artifact is read.
 */

/** Weight bases the build derives from postcodes, beside those artifacts declare. */
export const POSTCODE_WEIGHT_BASES: Record<string, string> = {
	postcodes: "Live small-user postcodes in the overlap",
	households: "Households in the overlap",
};

/** The measure of each basis, as the columns of `set_measure`. */
const MEASURES = ["postcodes", "population", "households"] as const;
type Measure = (typeof MEASURES)[number];

/** A count of one measure for each area of one placed release. */
export type WeightUnits = {
	basis: Exclude<Measure, "postcodes">;
	geography: string;
	boundaryRelease: string;
	/** The held count of each area, by code. */
	totals: ReadonlyMap<string, number>;
};

export type WeightUnitsSummary = {
	basis: Measure;
	geography: string;
	boundaryRelease: string;
	/** False when postcodes are not placed in the release, so nothing is shared. */
	placed: boolean;
	held: number;
	/** Shared out to postcodes; the rest is in units without a live postcode or area. */
	allocated: number;
};

export type WeightSummary = {
	units: WeightUnitsSummary[];
	crosswalks: Array<{
		slug: string;
		edges: number;
		/** Rows written, by basis. */
		weighted: Partial<Record<Measure, number>>;
	}>;
};

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

export const writeCrosswalkWeights = (
	database: DatabaseSync,
	units: readonly WeightUnits[],
): WeightSummary => {
	const columns = new Map<string, string>();
	for (const row of database
		.prepare(
			"SELECT geography, boundaryRelease, areaColumn FROM postcode_area_releases",
		)
		.all())
		columns.set(
			`${row.geography}/${row.boundaryRelease}`,
			quote(row.areaColumn as string),
		);
	// A crosswalk's own weights stay; anything else is from an earlier run.
	database.exec(
		"DELETE FROM crosswalk_weight WHERE basis_id IS NOT (SELECT c.basis_id FROM crosswalk c WHERE c.id = crosswalk_weight.crosswalk_id)",
	);

	database.exec(`
		DROP TABLE IF EXISTS temp.set_live;
		DROP TABLE IF EXISTS temp.unit_rate;
		DROP TABLE IF EXISTS temp.set_measure;
		CREATE TEMP TABLE set_live AS SELECT area_set_id AS set_id, count(*) AS postcodes FROM postcodes WHERE terminated = 0 AND largeUser = '0' GROUP BY area_set_id;
		CREATE TEMP TABLE unit_rate (area_version_id INTEGER NOT NULL, basis_id TEXT NOT NULL, rate REAL NOT NULL, PRIMARY KEY (area_version_id, basis_id)) WITHOUT ROWID;`);

	// Share each unit's count equally between its live small-user postcodes.
	const addRate = database.prepare("INSERT INTO unit_rate VALUES (?, ?, ?)");
	const summary: WeightSummary = { units: [], crosswalks: [] };
	const unitColumns = new Set<string>();
	for (const unit of units) {
		let held = 0;
		for (const total of unit.totals.values()) held += total;
		const column = columns.get(`${unit.geography}/${unit.boundaryRelease}`);
		let allocated = 0;
		if (column !== undefined) {
			unitColumns.add(column);
			for (const row of database
				.prepare(
					`SELECT v.id AS id, a.code AS code, u.live AS live
					FROM (SELECT s.${column} AS id, sum(l.postcodes) AS live FROM set_live l JOIN postcode_area_set s ON s.id = l.set_id WHERE s.${column} IS NOT NULL GROUP BY 1) u
					JOIN area_version v ON v.id = u.id
					JOIN area a ON a.id = v.area_id`,
				)
				.iterate()) {
				const total = unit.totals.get(row.code as string);
				if (total === undefined || !(total > 0)) continue;
				addRate.run(
					row.id as number,
					unit.basis,
					total / Number(row.live),
				);
				allocated += total;
			}
		}
		summary.units.push({
			basis: unit.basis,
			geography: unit.geography,
			boundaryRelease: unit.boundaryRelease,
			placed: column !== undefined,
			held,
			allocated,
		});
	}

	const inUnit = [...unitColumns].map((column) => `s.${column}`).join(", ");
	const measure = (basis: string) =>
		unitColumns.size === 0
			? "0"
			: `l.postcodes * coalesce((SELECT sum(r.rate) FROM unit_rate r WHERE r.basis_id = '${basis}' AND r.area_version_id IN (${inUnit})), 0)`;
	database.exec(
		`CREATE TEMP TABLE set_measure AS SELECT l.set_id AS set_id, l.postcodes AS postcodes, ${measure("population")} AS population, ${measure("households")} AS households FROM set_live l JOIN postcode_area_set s ON s.id = l.set_id`,
	);

	// Per crosswalk: the measure of every area of each side, and of each pair.
	const measureColumns = MEASURES.map((name) => `${name} REAL NOT NULL`).join(
		", ",
	);
	database.exec(`
		DROP TABLE IF EXISTS temp.pair;
		DROP TABLE IF EXISTS temp.source_total;
		DROP TABLE IF EXISTS temp.target_total;
		CREATE TEMP TABLE source_total (id INTEGER PRIMARY KEY, ${measureColumns});
		CREATE TEMP TABLE target_total (id INTEGER PRIMARY KEY, ${measureColumns});
		CREATE TEMP TABLE pair (f INTEGER NOT NULL, t INTEGER NOT NULL, ${measureColumns}, PRIMARY KEY (f, t)) WITHOUT ROWID;`);
	const insertWeight = (measureName: Measure) =>
		database.prepare(
			`INSERT INTO crosswalk_weight
			SELECT e.crosswalk_id, e.from_version_id, e.to_version_id, ?2,
				p.${measureName} / sum(p.${measureName}) OVER (PARTITION BY e.from_version_id),
				p.${measureName}, p.${measureName} / st.${measureName}, p.${measureName} / tt.${measureName}
			FROM crosswalk_edge e
			JOIN pair p ON p.f = e.from_version_id AND p.t = e.to_version_id
			JOIN source_total st ON st.id = e.from_version_id
			JOIN target_total tt ON tt.id = e.to_version_id
			WHERE e.crosswalk_id = ?1 AND p.${measureName} > 0`,
		);
	const inserts = Object.fromEntries(
		MEASURES.map((name) => [name, insertWeight(name)]),
	) as Record<Measure, ReturnType<typeof insertWeight>>;
	const totalColumns = MEASURES.map(
		(name) => `sum(m.${name}) AS ${name}`,
	).join(", ");
	const edgeCount = database.prepare(
		"SELECT count(*) AS edges FROM crosswalk_edge WHERE crosswalk_id = ?",
	);
	for (const crosswalk of database
		.prepare(
			`SELECT c.id AS id, c.slug AS slug, c.basis_id AS basis, f.geography AS fromGeography, f.id AS fromRelease, t.geography AS toGeography, t.id AS toRelease
			FROM crosswalk c
			JOIN area_releases f ON f.position = c.from_release_id
			JOIN area_releases t ON t.position = c.to_release_id
			WHERE c.method <> 'extent-continuity'
			ORDER BY c.id`,
		)
		.all()) {
		const from = columns.get(
			`${crosswalk.fromGeography}/${crosswalk.fromRelease}`,
		);
		const to = columns.get(
			`${crosswalk.toGeography}/${crosswalk.toRelease}`,
		);
		if (from === undefined || to === undefined || from === to) continue;
		database.exec(`
			DELETE FROM temp.source_total;
			DELETE FROM temp.target_total;
			DELETE FROM temp.pair;
			INSERT INTO temp.source_total SELECT s.${from}, ${totalColumns} FROM postcode_area_set s JOIN set_measure m ON m.set_id = s.id WHERE s.${from} IS NOT NULL GROUP BY 1;
			INSERT INTO temp.target_total SELECT s.${to}, ${totalColumns} FROM postcode_area_set s JOIN set_measure m ON m.set_id = s.id WHERE s.${to} IS NOT NULL GROUP BY 1;
			INSERT INTO temp.pair SELECT s.${from}, s.${to}, ${totalColumns} FROM postcode_area_set s JOIN set_measure m ON m.set_id = s.id WHERE s.${from} IS NOT NULL AND s.${to} IS NOT NULL GROUP BY 1, 2;`);
		const weighted: Partial<Record<Measure, number>> = {};
		for (const name of MEASURES) {
			if (crosswalk.basis === name) continue;
			const changes = Number(
				inserts[name].run(crosswalk.id as number, name).changes,
			);
			if (changes > 0) weighted[name] = changes;
		}
		summary.crosswalks.push({
			slug: crosswalk.slug as string,
			edges: Number(edgeCount.get(crosswalk.id as number)!.edges),
			weighted,
		});
	}
	database.exec(`
		DROP TABLE temp.pair;
		DROP TABLE temp.source_total;
		DROP TABLE temp.target_total;
		DROP TABLE temp.set_measure;
		DROP TABLE temp.unit_rate;
		DROP TABLE temp.set_live;`);
	return summary;
};
