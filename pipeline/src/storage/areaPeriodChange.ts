import type { DatabaseSync } from "node:sqlite";
import {
	NOT_COMPARED_OVER_TIME,
	NOT_COMPARED_STATISTICS,
	SERIES_BREAKS,
} from "@uk-data-atlas/measures";
import { STANDARD_RELEASES } from "../conversion/standardPlan.ts";
import { MATERIAL_SHARE } from "./areaChangeExtent.ts";

/**
 * How much an area changed between two periods on one set of boundaries, and
 * how much of the change as published came from boundaries moving:
 * `area_period_change`, `area_change_span`, `series_published_counterpart`,
 * `measure_break` and `v_area_period_change` (docs/database-roadmap.md, task 44). Written at atlas
 * assembly, after `series_coverage`.
 *
 * - `area_period_change` has one row for each quantity, area and pair of
 *   periods where the default value (`v_observation_default`'s rule: the
 *   best-ranked series with an observation row) is a number at both ends.
 *   The pairs are each period with the next one, and the first with the
 *   latest. Only the values and the series they came from are stored; the
 *   view works out the rest.
 * - The quantities are those of the latest release of each standard geography
 *   (`STANDARD_RELEASES`), where every period is on the same boundaries,
 *   converted where it was not published on them, and those of every release
 *   of a geography with no standard release, where values are only ever on the
 *   release they were published on.
 * - A measure whose statistic is a rank, category, index or interval, or which
 *   is already a change (`NOT_COMPARED_OVER_TIME`), is left out.
 * - `area_change_span` says how much the area's boundary moved between the
 *   two releases the ends were published on, from `area_change_extent`'s
 *   same-code hops. It is written only for the pairs of releases a row needs.
 * - `series_published_counterpart` names, for each converted series, what
 *   it was converted from as published: the published series with the same
 *   breakdown on the source release, or the published parts it sums.
 * - `measure_break` holds the method breaks `SERIES_BREAKS` declares, for the
 *   measures and periods of this build.
 *
 * The view compares the fixed-boundary change with the change as published,
 * each end on the boundaries it was published on, where the same code was
 * published at both ends. It never guesses a published value for a code that
 * was not published.
 */

const TABLES = `
CREATE TABLE area_period_change (
	quantity_id INTEGER NOT NULL REFERENCES quantity(id),
	area_version_id INTEGER NOT NULL REFERENCES area_version(id),
	from_period_id INTEGER NOT NULL REFERENCES period(id),
	to_period_id INTEGER NOT NULL REFERENCES period(id),
	from_series_id INTEGER NOT NULL REFERENCES series(id),
	to_series_id INTEGER NOT NULL REFERENCES series(id),
	from_value REAL NOT NULL,
	to_value REAL NOT NULL,
	adjacent INTEGER NOT NULL CHECK (adjacent IN (0, 1)),
	CHECK (from_period_id <> to_period_id),
	PRIMARY KEY (quantity_id, area_version_id, from_period_id, to_period_id)
) WITHOUT ROWID, STRICT;
CREATE TABLE area_change_span (
	from_version_id INTEGER NOT NULL REFERENCES area_version(id),
	to_version_id INTEGER NOT NULL REFERENCES area_version(id),
	hops INTEGER NOT NULL CHECK (hops >= 1),
	residents_lost REAL CHECK (residents_lost BETWEEN 0 AND 1),
	residents_gained REAL CHECK (residents_gained BETWEEN 0 AND 1),
	land_lost REAL CHECK (land_lost BETWEEN 0 AND 1),
	land_gained REAL CHECK (land_gained BETWEEN 0 AND 1),
	materially_changed INTEGER CHECK (materially_changed IN (0, 1)),
	CHECK (from_version_id <> to_version_id),
	PRIMARY KEY (from_version_id, to_version_id)
) WITHOUT ROWID, STRICT;
CREATE TABLE series_published_counterpart (
	series_id INTEGER NOT NULL REFERENCES series(id),
	published_series_id INTEGER REFERENCES series(id),
	release_id INTEGER NOT NULL REFERENCES area_release(id),
	parts INTEGER CHECK (parts >= 2),
	CHECK ((published_series_id IS NULL) <> (parts IS NULL)),
	PRIMARY KEY (series_id)
) WITHOUT ROWID, STRICT;
CREATE TABLE measure_break (
	measure_id INTEGER NOT NULL REFERENCES measure(id),
	dataset_id INTEGER NOT NULL REFERENCES dataset(id),
	period_id INTEGER NOT NULL REFERENCES period(id),
	kind TEXT NOT NULL CHECK (kind IN ('classification', 'sample', 'census')),
	effect TEXT NOT NULL CHECK (effect IN ('spans', 'touches')),
	note TEXT NOT NULL,
	PRIMARY KEY (measure_id, dataset_id, period_id, kind)
) WITHOUT ROWID, STRICT;`;

/**
 * The accuracy of one end, best first: `published` on these boundaries,
 * `regrouped` (converted, every value whole areas), `estimated` (converted
 * with a split, a `series_estimate` row) and `modelled`.
 */
const endAccuracy = (side: "f" | "t") => `CASE ${side}s.method
    WHEN 'published' THEN 'published'
    WHEN 'converted' THEN CASE WHEN EXISTS (
      SELECT 1 FROM series_estimate e WHERE e.series_id = ${side}s.id
        AND e.area_version_id = c.area_version_id AND e.period_id = c.${side === "f" ? "from" : "to"}_period_id)
      THEN 'estimated' ELSE 'regrouped' END
    ELSE 'modelled' END`;

const periodOf = (side: "f" | "t") =>
	`c.${side === "f" ? "from" : "to"}_period_id`;

/** Whether a converted end has a published counterpart to compare with. */
const traced = (side: "f" | "t") => `CASE ${side}s.method
    WHEN 'published' THEN 1
    WHEN 'converted' THEN EXISTS (SELECT 1 FROM series_published_counterpart k WHERE k.series_id = ${side}s.id)
    ELSE 0 END`;

/** The area version, same code, the end's value was published on, or null. */
const publishedVersion = (side: "f" | "t") => `CASE ${side}s.method
    WHEN 'published' THEN c.area_version_id
    WHEN 'converted' THEN (SELECT pv.id FROM series_published_counterpart k
      JOIN area_version pv ON pv.release_id = k.release_id AND pv.area_id = v.area_id
      WHERE k.series_id = ${side}s.id) END`;

/**
 * The value as published on its own boundaries, or null: the counterpart's
 * value, or the sum of the published parts when every part has one.
 */
const publishedValue = (side: "f" | "t") => `CASE ${side}s.method
    WHEN 'published' THEN c.${side === "f" ? "from" : "to"}_value
    WHEN 'converted' THEN (SELECT CASE WHEN k.published_series_id IS NOT NULL
        THEN (SELECT po.value FROM observation po WHERE po.series_id = k.published_series_id
          AND po.area_version_id = pv.id AND po.period_id = ${periodOf(side)})
        ELSE (SELECT CASE WHEN count(po.value) = k.parts THEN sum(po.value) END
          FROM series_input i JOIN observation po ON po.series_id = i.input_series_id
            AND po.area_version_id = pv.id AND po.period_id = ${periodOf(side)}
          WHERE i.series_id = k.series_id) END
      FROM series_published_counterpart k
      JOIN area_version pv ON pv.release_id = k.release_id AND pv.area_id = v.area_id
      WHERE k.series_id = ${side}s.id) END`;

/** Whether the end's published value is a sum of published parts. */
const fromParts = (
	side: "f" | "t",
) => `EXISTS (SELECT 1 FROM series_published_counterpart k
      WHERE k.series_id = ${side}s.id AND k.parts IS NOT NULL)`;

/** The order of `accuracy`, best first. */
export const ACCURACIES = [
	"published",
	"regrouped",
	"estimated",
	"modelled",
] as const;

const accuracyRank = (column: string) =>
	`CASE ${column} ${ACCURACIES.map((accuracy, rank) => `WHEN '${accuracy}' THEN ${rank}`).join(" ")} END`;

const breakMatch = `b.measure_id = x.measure_id
      AND b.dataset_id IN (x.from_dataset_id, x.to_dataset_id)
      AND CASE b.effect
        WHEN 'spans' THEN fp.start_date < bp.start_date AND tp.start_date >= bp.start_date
        ELSE b.period_id IN (x.from_period_id, x.to_period_id) END`;

/** Zero when both ends were published on one release, else the span's figure. */
const spanShare = (column: string) =>
	`CASE WHEN x.from_published_version_id = x.to_published_version_id THEN 0 ELSE cs.${column} END`;

/**
 * One readable row per stored change. `change` and `percent_change` are on
 * the area's boundaries in this release; `published_change` is the change
 * between the values as published, each on the boundaries of its own
 * release, and `boundary_effect` (`published_change - change`) how much of it
 * the boundary moves account for. `percent_change` is null when the start is
 * zero or the measure is itself a percentage (`change` is then in percentage
 * points).
 */
export const AREA_PERIOD_CHANGE_VIEW = `
SELECT m.slug AS measure, q.key AS quantity, r.geography, r.release,
  a.code AS area_code, v.name AS area_name,
  fp.label AS from_period, tp.label AS to_period,
  CASE x.adjacent WHEN 1 THEN 'adjacent' ELSE 'first-latest' END AS span,
  x.from_value, x.to_value, x.to_value - x.from_value AS change,
  CASE WHEN x.from_value <> 0 AND u.kind <> 'percent'
    THEN 100.0 * (x.to_value - x.from_value) / abs(x.from_value) END AS percent_change,
  x.from_accuracy, x.to_accuracy,
  CASE WHEN ${accuracyRank("x.from_accuracy")} >= ${accuracyRank("x.to_accuracy")}
    THEN x.from_accuracy ELSE x.to_accuracy END AS accuracy,
  CASE
    WHEN x.from_accuracy = 'modelled' OR x.to_accuracy = 'modelled' THEN 'modelled'
    WHEN NOT x.from_traced OR NOT x.to_traced THEN 'not-traced'
    WHEN x.from_published_version_id IS NULL OR x.to_published_version_id IS NULL THEN 'code-not-published'
    WHEN x.from_published_value IS NULL OR x.to_published_value IS NULL THEN 'value-not-published'
    ELSE 'published'
  END AS boundary_check,
  x.from_published_value, x.to_published_value,
  x.from_parts OR x.to_parts AS published_from_parts,
  x.to_published_value - x.from_published_value AS published_change,
  (x.to_published_value - x.from_published_value) - (x.to_value - x.from_value) AS boundary_effect,
  CASE WHEN x.from_published_version_id IS NOT NULL AND x.to_published_version_id IS NOT NULL
    THEN ${spanShare("materially_changed")} END AS materially_changed,
  ${spanShare("residents_lost")} AS residents_lost,
  ${spanShare("residents_gained")} AS residents_gained,
  ${spanShare("land_lost")} AS land_lost,
  ${spanShare("land_gained")} AS land_gained,
  fd.slug AS from_dataset, td.slug AS to_dataset,
  x.from_dataset_id <> x.to_dataset_id AS source_changed,
  fp.kind <> tp.kind AS period_kind_changed,
  fp.end_date >= tp.start_date AS periods_overlap,
  (SELECT group_concat(b.kind || ' ' || bp.label, '; ' ORDER BY bp.start_date, b.kind) FROM measure_break b
    JOIN period bp ON bp.id = b.period_id WHERE ${breakMatch}) AS breaks,
  (SELECT group_concat(note, ' ') FROM (SELECT DISTINCT b.note FROM measure_break b
    JOIN period bp ON bp.id = b.period_id WHERE ${breakMatch} ORDER BY b.note)) AS break_notes,
  x.quantity_id, x.area_version_id, x.from_period_id, x.to_period_id,
  x.from_series_id, x.to_series_id,
  x.from_published_version_id, x.to_published_version_id
FROM (
  SELECT c.*, q.measure_id, v.area_id,
    fs.dataset_id AS from_dataset_id, ts.dataset_id AS to_dataset_id,
    ${endAccuracy("f")} AS from_accuracy,
    ${endAccuracy("t")} AS to_accuracy,
    ${traced("f")} AS from_traced, ${traced("t")} AS to_traced,
    ${publishedVersion("f")} AS from_published_version_id,
    ${publishedVersion("t")} AS to_published_version_id,
    ${publishedValue("f")} AS from_published_value,
    ${publishedValue("t")} AS to_published_value,
    ${fromParts("f")} AS from_parts, ${fromParts("t")} AS to_parts
  FROM area_period_change c
  JOIN quantity q ON q.id = c.quantity_id
  JOIN area_version v ON v.id = c.area_version_id
  JOIN series fs ON fs.id = c.from_series_id
  JOIN series ts ON ts.id = c.to_series_id) x
JOIN quantity q ON q.id = x.quantity_id
JOIN measure m ON m.id = x.measure_id
JOIN unit u ON u.id = m.unit_id
JOIN area_version v ON v.id = x.area_version_id
JOIN area a ON a.id = v.area_id
JOIN area_release r ON r.id = v.release_id
JOIN period fp ON fp.id = x.from_period_id
JOIN period tp ON tp.id = x.to_period_id
JOIN dataset fd ON fd.id = x.from_dataset_id
JOIN dataset td ON td.id = x.to_dataset_id
LEFT JOIN area_change_span cs ON cs.from_version_id = x.from_published_version_id
  AND cs.to_version_id = x.to_published_version_id`;

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;

/** The releases whose quantities are compared over time. */
const targetReleaseIds = (database: DatabaseSync): number[] => {
	const standard = STANDARD_RELEASES.map((entry) => entry.split(":"));
	const geographies = [...new Set(standard.map(([geography]) => geography))];
	return (
		database
			.prepare(
				`SELECT id FROM area_release
				 WHERE (geography, release) IN (VALUES ${standard.map(([g, r]) => `(${literal(g!)}, ${literal(r!)})`).join(", ")})
				   OR geography NOT IN (${geographies.map((g) => literal(g!)).join(", ")})
				 ORDER BY id`,
			)
			.all() as Array<{ id: number }>
	).map((row) => row.id);
};

/** Writes `measure_break` from `SERIES_BREAKS`, for what this build holds. */
const writeMeasureBreaks = (database: DatabaseSync) => {
	const insert = database.prepare(`
INSERT INTO measure_break (measure_id, dataset_id, period_id, kind, effect, note)
SELECT DISTINCT m.id, s.dataset_id, p.id, ?, ?, ?
FROM measure m JOIN series s ON s.measure_id = m.id
JOIN dataset d ON d.id = s.dataset_id
JOIN period p ON p.label = ?
WHERE m.slug = ? AND (? IS NULL OR d.slug IN (SELECT value FROM json_each(?)))`);
	for (const [slug, breaks] of Object.entries(SERIES_BREAKS))
		for (const declared of breaks) {
			const datasets =
				declared.datasets === undefined
					? null
					: JSON.stringify(declared.datasets);
			insert.run(
				declared.kind,
				declared.effect,
				declared.note,
				declared.period,
				slug,
				datasets,
				datasets,
			);
		}
};

/**
 * Writes `series_published_counterpart`: for each converted series, the
 * published series of the same dataset, measure and breakdown on the release
 * it was converted from, or, for a series the converter summed from published
 * parts with no published total, the number of parts (`series_input`, every
 * one a value on that release). A converted series with neither gets no row.
 */
const writeCounterparts = (database: DatabaseSync) => {
	database.exec(`
CREATE TEMP TABLE series_members AS
SELECT s.id, coalesce((SELECT group_concat(dimension_id || '=' || member_id, ',')
  FROM (SELECT dimension_id, member_id FROM series_member m WHERE m.series_id = s.id
    ORDER BY dimension_id, member_id)), '') AS members
FROM series s WHERE s.method IN ('published', 'converted')`);
	database.exec(`
INSERT INTO series_published_counterpart (series_id, published_series_id, release_id)
SELECT s.id, min(p.id), src.release_id
FROM series s
JOIN series src ON src.id = s.derived_from_id
JOIN temp.series_members sm ON sm.id = s.id
JOIN series p ON p.method = 'published' AND p.dataset_id = s.dataset_id
  AND p.measure_id = s.measure_id AND p.release_id = src.release_id
JOIN temp.series_members pm ON pm.id = p.id AND pm.members = sm.members
WHERE s.method = 'converted'
GROUP BY s.id HAVING count(*) = 1`);
	database.exec(`
INSERT INTO series_published_counterpart (series_id, release_id, parts)
SELECT s.id, src.release_id, count(*)
FROM series s
JOIN series src ON src.id = s.derived_from_id
JOIN series_input i ON i.series_id = s.id
JOIN series part ON part.id = i.input_series_id
WHERE s.method = 'converted'
  AND s.id NOT IN (SELECT series_id FROM series_published_counterpart)
GROUP BY s.id
HAVING count(*) >= 2 AND min(i.role = 'value') = 1
  AND min(part.method = 'published' AND part.release_id = src.release_id) = 1`);
	database.exec("DROP TABLE temp.series_members");
};

/**
 * Pairs every compared quantity's default values: each period with the next,
 * and the first with the latest when there are more than two.
 */
const writeChanges = (database: DatabaseSync, releases: readonly number[]) => {
	database.exec(`
CREATE TEMP TABLE compared_quantity AS
SELECT q.id FROM quantity q JOIN measure m ON m.id = q.measure_id
WHERE q.release_id IN (${releases.join(", ") || "NULL"})
  AND m.statistic NOT IN (${NOT_COMPARED_STATISTICS.map(literal).join(", ")})
  AND m.slug NOT IN (${Object.keys(NOT_COMPARED_OVER_TIME).map(literal).join(", ") || "''"})`);
	database.exec(`
CREATE TEMP TABLE compared_value AS
SELECT quantity_id, area_version_id, period_id, series_id, value,
  row_number() OVER w AS n, count(*) OVER (PARTITION BY quantity_id, area_version_id) AS total
FROM (
  SELECT sp.quantity_id, o.area_version_id, o.period_id, o.series_id, o.value,
    p.start_date, p.end_date,
    row_number() OVER (PARTITION BY sp.quantity_id, o.area_version_id, o.period_id
      ORDER BY sp.rank) AS pick
  FROM temp.compared_quantity cq
  JOIN series_preference sp ON sp.quantity_id = cq.id
  JOIN observation o ON o.series_id = sp.series_id
  JOIN period p ON p.id = o.period_id)
WHERE pick = 1 AND value IS NOT NULL
WINDOW w AS (PARTITION BY quantity_id, area_version_id ORDER BY start_date, end_date, period_id)`);
	database.exec(`
INSERT INTO area_period_change
SELECT a.quantity_id, a.area_version_id, a.period_id, b.period_id,
  a.series_id, b.series_id, a.value, b.value, b.n = a.n + 1
FROM temp.compared_value a
JOIN temp.compared_value b ON b.quantity_id = a.quantity_id
  AND b.area_version_id = a.area_version_id
  AND (b.n = a.n + 1 OR (a.n = 1 AND b.n = b.total AND b.total > 2))`);
	database.exec(
		"DROP TABLE temp.compared_value; DROP TABLE temp.compared_quantity",
	);
};

/**
 * Writes `area_change_span` for every pair of area versions two ends of a
 * change were published on, where they differ: the same-code hops of
 * `area_change_extent` from the earlier to the later, and the largest share
 * any one hop moved. A pair the hops do not join gets no row.
 */
const writeSpans = (database: DatabaseSync) => {
	database.exec(`
CREATE TEMP TABLE span_pair AS
SELECT DISTINCT from_published_version_id AS f, to_published_version_id AS t
FROM (SELECT ${publishedVersion("f")} AS from_published_version_id,
    ${publishedVersion("t")} AS to_published_version_id
  FROM area_period_change c
  JOIN area_version v ON v.id = c.area_version_id
  JOIN series fs ON fs.id = c.from_series_id
  JOIN series ts ON ts.id = c.to_series_id
  WHERE fs.method IN ('published', 'converted') AND ts.method IN ('published', 'converted'))
WHERE f IS NOT NULL AND t IS NOT NULL AND f <> t`);
	database.exec(`
INSERT INTO area_change_span
WITH RECURSIVE walk (start, cur, hops, rl, rg, ll, lg) AS (
  SELECT f, f, 0, 0.0, 0.0, NULL, NULL FROM temp.span_pair
  UNION SELECT t, t, 0, 0.0, 0.0, NULL, NULL FROM temp.span_pair
  UNION ALL
  SELECT w.start, x.to_version_id, w.hops + 1,
    max(w.rl, x.residents_lost), max(w.rg, x.residents_gained),
    coalesce(max(w.ll, x.land_lost), w.ll, x.land_lost),
    coalesce(max(w.lg, x.land_gained), w.lg, x.land_gained)
  FROM walk w JOIN area_change_extent x
    ON x.from_version_id = w.cur AND x.successor = 'same-code'
  WHERE w.hops < 64)
SELECT p.f, p.t, w.hops, w.rl, w.rg, w.ll, w.lg,
  CASE WHEN max(w.rl, w.rg, coalesce(w.ll, 0), coalesce(w.lg, 0)) >= ${MATERIAL_SHARE} THEN 1
    WHEN w.rl IS NOT NULL AND w.rg IS NOT NULL THEN 0 END
FROM temp.span_pair p
JOIN walk w ON (w.start = p.f AND w.cur = p.t) OR (w.start = p.t AND w.cur = p.f)
WHERE w.hops > 0`);
	database.exec("DROP TABLE temp.span_pair");
};

export type AreaPeriodChangeSummary = {
	rows: number;
	counterparts: number;
	spans: number;
	breaks: number;
};

/**
 * Writes `measure_break`, `series_published_counterpart`,
 * `area_period_change`, `area_change_span` and
 * `v_area_period_change`. Needs `series_preference`, so call it after
 * `writeDefaultObservation`. Without `area_change_extent` (an atlas built
 * without crosswalk weights) no span is written and the view says nothing of
 * how far a boundary moved.
 */
export const writeAreaPeriodChange = (
	database: DatabaseSync,
): AreaPeriodChangeSummary => {
	database.exec(TABLES);
	writeMeasureBreaks(database);
	writeCounterparts(database);
	writeChanges(database, targetReleaseIds(database));
	if (
		database
			.prepare(
				"SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'area_change_extent'",
			)
			.get()
	)
		writeSpans(database);
	database.exec(
		`CREATE VIEW v_area_period_change AS${AREA_PERIOD_CHANGE_VIEW}`,
	);
	const count = (table: string) =>
		Number(
			(
				database
					.prepare(`SELECT count(*) AS n FROM ${table}`)
					.get() as {
					n: number;
				}
			).n,
		);
	return {
		rows: count("area_period_change"),
		counterparts: count("series_published_counterpart"),
		spans: count("area_change_span"),
		breaks: count("measure_break"),
	};
};
