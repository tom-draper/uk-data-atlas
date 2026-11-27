import type { DatabaseSync } from "node:sqlite";

/**
 * What the release can answer, before any observation is read:
 * `series_coverage`, `v_coverage` and `v_coverage_missing`. Written at atlas
 * assembly, after every series is in and ranked (`writeDefaultObservation`)
 * and before `ANALYZE`.
 *
 * - `series_coverage` has one row for each (series, period) that holds
 *   observations: how many areas have a row, how many of those have a value,
 *   how many areas the series' release holds, which nations have a value and
 *   how many areas `v_observation_default` takes from the series. About 9,000
 *   rows for 10.7 million observations.
 * - `v_coverage` reads one readable row per (series, period), with the method,
 *   whether the default view takes any area from the series (`is_default`),
 *   how many and what share of the release (`default_areas`,
 *   `default_share`), the share of the release covered and, for a converted
 *   series, its `series_conversion` quality.
 * - `v_coverage_missing` lists the measure, geography and release
 *   combinations the conversion planner considered and left with no series,
 *   and why (`conversion_skip`).
 *
 * The nation of an area is not stored in the schema for every area
 * (`area_hierarchy` links 361 areas to a country), so it is derived, in this
 * order: the ONS code prefix (E, W, S or N), then the one nation of a release
 * that `boundary_release_country` says covers only one, then the ITL code
 * letter (TLC to TLK England, TLL Wales, TLM Scotland, TLN Northern Ireland),
 * and otherwise `?` (historical constituencies, which carry numeric codes on a
 * UK release).
 */

/** The order of the nations in `series_coverage.countries`. `?` is last. */
export const NATIONS = ["E", "N", "S", "W", "?"] as const;

export type Nation = (typeof NATIONS)[number];

const COUNTRY_CODES: Readonly<Record<string, Nation>> = {
	"GB-ENG": "E",
	"GB-NIR": "N",
	"GB-SCT": "S",
	"GB-WLS": "W",
};

/** The nation of an area, from its code and the nations its release covers. */
export const nationOf = (
	code: string,
	releaseNations: readonly Nation[],
): Nation => {
	const first = code.charAt(0);
	if (first === "E" || first === "W" || first === "S" || first === "N")
		return first;
	const only = releaseNations.length === 1 ? releaseNations[0] : undefined;
	if (only !== undefined) return only;
	if (code.startsWith("TL")) {
		const letter = code.charAt(2);
		if (letter >= "C" && letter <= "K") return "E";
		if (letter === "L") return "W";
		if (letter === "M") return "S";
		if (letter === "N") return "N";
	}
	return "?";
};

/** The sorted list stored in `series_coverage.countries`. */
export const formatCountries = (nations: Iterable<Nation>): string => {
	const present = new Set(nations);
	return NATIONS.filter((nation) => present.has(nation)).join(",");
};

const TABLE = `
CREATE TABLE series_coverage (
	series_id INTEGER NOT NULL REFERENCES series(id),
	period_id INTEGER NOT NULL REFERENCES period(id),
	areas INTEGER NOT NULL CHECK (areas >= 1),
	areas_with_value INTEGER NOT NULL CHECK (areas_with_value BETWEEN 0 AND areas),
	release_areas INTEGER NOT NULL CHECK (release_areas >= 0),
	countries TEXT NOT NULL,
	default_areas INTEGER NOT NULL DEFAULT 0 CHECK (default_areas BETWEEN 0 AND areas),
	PRIMARY KEY (series_id, period_id)
) WITHOUT ROWID, STRICT;`;

/**
 * One readable row per (series, period). The quantity and rank are empty for
 * a series that is not at the default of every breakdown (a part of a total),
 * which is in no quantity, and it has no default areas. `is_default` is 1
 * when `v_observation_default` takes at least one area from the series in the
 * period, whatever its rank. The members lookup matches the one in
 * `v_observation_default`.
 */
export const COVERAGE_VIEW = `
SELECT m.slug AS measure, q.key AS quantity,
  (SELECT group_concat(dim.slug || '=' || dm.code, '; ')
   FROM series_member sm JOIN dimension dim ON dim.id = sm.dimension_id
   JOIN dimension_member dm ON dm.id = sm.member_id
   WHERE sm.series_id = s.id) AS members,
  d.slug AS dataset, r.geography, r.release, p.label AS period,
  p.kind AS period_kind, p.start_date AS period_start, p.end_date AS period_end,
  s.method, sc.default_areas > 0 AS is_default, sp.rank AS preference_rank,
  sc.areas, sc.areas_with_value, sc.release_areas,
  CASE WHEN sc.release_areas > 0
    THEN round(1.0 * sc.areas_with_value / sc.release_areas, 4) END AS share,
  sc.default_areas,
  CASE WHEN sc.release_areas > 0
    THEN round(1.0 * sc.default_areas / sc.release_areas, 4) END AS default_share,
  sc.countries, c.exact_share, c.coverage, s.id AS series_id
FROM series_coverage sc
JOIN series s ON s.id = sc.series_id
JOIN measure m ON m.id = s.measure_id
JOIN dataset d ON d.id = s.dataset_id
JOIN area_release r ON r.id = s.release_id
JOIN period p ON p.id = sc.period_id
LEFT JOIN series_preference sp ON sp.series_id = s.id
LEFT JOIN quantity q ON q.id = sp.quantity_id
LEFT JOIN series_conversion c ON c.series_id = s.id`;

/**
 * The measure, geography and release combinations the conversion planner
 * considered and that have no series, with the reason. A skip whose target
 * release does have a series for the measure (published or converted from
 * another dataset, or a better route) is not missing and is left out. A
 * combination appears once for each dataset, source release and reason.
 */
export const COVERAGE_MISSING_VIEW = `
SELECT m.slug AS measure, tr.geography, tr.release, cs.reason,
  CASE cs.reason
    WHEN 'refused-measure' THEN coalesce(mc.reason, 'The measure is not converted between boundary releases.')
    WHEN 'no-route' THEN 'No crosswalk path from the source release to this one.'
    WHEN 'no-values' THEN 'Every value would be an apportioned split, and splitting this measure is refused.'
    WHEN 'missing-component' THEN 'A ratio lacks its numerator, denominator or weight on this release.'
    WHEN 'better-route' THEN 'Every value it would give came from a better source.'
    ELSE 'Already published on this release for every period it holds.'
  END AS explanation,
  d.slug AS dataset, sr.geography AS source_geography, sr.release AS source_release,
  cs.series AS source_series
FROM conversion_skip cs
JOIN measure m ON m.id = cs.measure_id
JOIN dataset d ON d.id = cs.dataset_id
JOIN area_release tr ON tr.id = cs.target_release_id
JOIN area_release sr ON sr.id = cs.source_release_id
LEFT JOIN measure_conversion mc ON mc.measure_id = cs.measure_id
WHERE NOT EXISTS (
  SELECT 1 FROM series s
  WHERE s.measure_id = cs.measure_id AND s.release_id = cs.target_release_id)`;

const tableExists = (database: DatabaseSync, name: string) =>
	database
		.prepare(
			"SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?",
		)
		.get(name) !== undefined;

const countriesSql = NATIONS.map(
	(nation) =>
		`CASE WHEN max(o.has_value AND n.nation = '${nation}') THEN '${nation},' ELSE '' END`,
).join(" || ");

export type SeriesCoverageSummary = {
	rows: number;
	/** Rows where the series holds an observation for fewer than half the release's areas. */
	belowHalf: number;
};

/** Fills a temp table with the nation of every area version. */
const writeAreaNations = (database: DatabaseSync) => {
	const releaseNations = new Map<number, Nation[]>();
	if (tableExists(database, "boundary_release_country"))
		for (const row of database
			.prepare(
				"SELECT release_id AS id, country FROM boundary_release_country",
			)
			.all() as Array<{ id: number; country: string }>) {
			const nation = COUNTRY_CODES[row.country];
			if (nation === undefined) continue;
			const list = releaseNations.get(row.id) ?? [];
			list.push(nation);
			releaseNations.set(row.id, list);
		}
	database.exec(
		"CREATE TEMP TABLE area_nation (area_version_id INTEGER PRIMARY KEY, nation TEXT NOT NULL)",
	);
	const insert = database.prepare(
		"INSERT INTO temp.area_nation VALUES (?, ?)",
	);
	for (const row of database
		.prepare(
			"SELECT v.id, a.code, v.release_id FROM area_version v JOIN area a ON a.id = v.area_id",
		)
		.iterate() as Iterable<{
		id: number;
		code: string;
		release_id: number;
	}>)
		insert.run(
			row.id,
			nationOf(row.code, releaseNations.get(row.release_id) ?? []),
		);
};

/**
 * Fills `series_coverage.default_areas` with the rule of
 * `v_observation_default`: an area and period of a quantity belong to the
 * best-ranked series that has an observation row there, a NULL value
 * included. The rank 1 series of a quantity takes every area it has. Only a
 * series of lower rank needs a lookup, and one grouped pass over the
 * observations of those series counts the areas no better series holds.
 */
const writeDefaultAreas = (database: DatabaseSync) => {
	database.exec(`
UPDATE series_coverage SET default_areas = areas
WHERE series_id IN (SELECT series_id FROM series_preference WHERE rank = 1)`);
	database.exec(`
UPDATE series_coverage SET default_areas = t.n
FROM (
  SELECT o.series_id, o.period_id, count(*) AS n
  FROM series_preference sp
  JOIN observation o ON o.series_id = sp.series_id
  WHERE sp.rank > 1 AND NOT EXISTS (
    SELECT 1 FROM series_preference better
    JOIN observation ob ON ob.series_id = better.series_id
      AND ob.area_version_id = o.area_version_id AND ob.period_id = o.period_id
    WHERE better.quantity_id = sp.quantity_id AND better.rank < sp.rank)
  GROUP BY o.series_id, o.period_id) t
WHERE series_coverage.series_id = t.series_id
  AND series_coverage.period_id = t.period_id`);
};

/**
 * Fails, naming what is wrong, when a (series, period) of `observation` has no
 * coverage row or the reverse, the counts do not nest, or a series holds
 * observations on more areas than its release (reported, never clamped).
 */
export const checkSeriesCoverage = (database: DatabaseSync): void => {
	const one = (sql: string) =>
		Number(database.prepare(sql).get()!.n as number);
	const missing = one(
		"SELECT count(*) AS n FROM (SELECT DISTINCT series_id, period_id FROM observation) o WHERE NOT EXISTS (SELECT 1 FROM series_coverage c WHERE c.series_id = o.series_id AND c.period_id = o.period_id)",
	);
	const extra = one(
		"SELECT count(*) AS n FROM series_coverage c WHERE NOT EXISTS (SELECT 1 FROM observation o WHERE o.series_id = c.series_id AND o.period_id = c.period_id)",
	);
	if (missing > 0 || extra > 0)
		throw new Error(
			`series_coverage does not match observation: ${missing} (series, period) pairs have no row and ${extra} rows have no observations.`,
		);
	const nested = database
		.prepare(
			"SELECT series_id, period_id FROM series_coverage WHERE areas_with_value > areas LIMIT 5",
		)
		.all() as Array<{ series_id: number; period_id: number }>;
	if (nested.length > 0)
		throw new Error(
			`series_coverage has more areas with a value than areas: ${nested.map((row) => `${row.series_id}/${row.period_id}`).join(", ")}`,
		);
	const over = database
		.prepare(
			"SELECT s.key, p.label, c.areas, c.release_areas FROM series_coverage c JOIN series s ON s.id = c.series_id JOIN period p ON p.id = c.period_id WHERE c.areas > c.release_areas ORDER BY s.key, p.label",
		)
		.all() as Array<{
		key: string;
		label: string;
		areas: number;
		release_areas: number;
	}>;
	if (over.length > 0)
		throw new Error(
			`${over.length} (series, period) pairs hold more areas than their release:\n${over
				.slice(0, 20)
				.map(
					(row) =>
						`${row.key} ${row.label}: ${row.areas} areas, release holds ${row.release_areas}`,
				)
				.join(
					"\n",
				)}${over.length > 20 ? `\n... and ${over.length - 20} more` : ""}`,
		);
};

/**
 * Writes `series_coverage`, `v_coverage` and `v_coverage_missing`. Fails when
 * a series and period of `observation` has no row, or the reverse, or when a
 * series holds observations on more areas than its release. Needs
 * `series_preference`, so call it after `writeDefaultObservation`.
 */
export const writeSeriesCoverage = (
	database: DatabaseSync,
): SeriesCoverageSummary => {
	database.exec(TABLE);
	writeAreaNations(database);
	try {
		database.exec(`
WITH release_counts AS (
  SELECT release_id, count(*) AS areas
  FROM area_version WHERE in_inventory = 1 GROUP BY release_id
), coverage AS (
  SELECT o.series_id, o.period_id, count(*) AS areas,
    sum(o.has_value) AS areas_with_value, rtrim(${countriesSql}, ',') AS countries
  FROM (SELECT series_id, period_id, area_version_id,
          value IS NOT NULL OR category_id IS NOT NULL AS has_value
        FROM observation) o
  JOIN temp.area_nation n ON n.area_version_id = o.area_version_id
  GROUP BY o.series_id, o.period_id
)
INSERT INTO series_coverage (series_id, period_id, areas, areas_with_value, release_areas, countries)
SELECT c.series_id, c.period_id, c.areas, c.areas_with_value,
  coalesce(r.areas, 0), c.countries
FROM coverage c
JOIN series s ON s.id = c.series_id
LEFT JOIN release_counts r ON r.release_id = s.release_id`);
	} finally {
		database.exec("DROP TABLE temp.area_nation");
	}
	writeDefaultAreas(database);
	checkSeriesCoverage(database);
	database.exec(`CREATE VIEW v_coverage AS${COVERAGE_VIEW}`);
	database.exec(`CREATE VIEW v_coverage_missing AS${COVERAGE_MISSING_VIEW}`);
	const counts = database
		.prepare(
			"SELECT count(*) AS rows, sum(areas_with_value * 2 < release_areas) AS below FROM series_coverage",
		)
		.get() as { rows: number; below: number | null };
	return { rows: counts.rows, belowHalf: counts.below ?? 0 };
};
