import type { DatabaseSync } from "node:sqlite";
import {
	REBUILT_RATES,
	type DenominatorReference,
} from "@uk-data-atlas/datasets";
import { ACCURACIES } from "./areaPeriodChange.ts";

/**
 * The rates the atlas rebuilds from two counts it holds (task 27). A rate is
 * the numerator over the denominator, each taken on the same area of the same
 * boundary release, times the rate's `per`. It is never an average of rates:
 * a rate for a larger area is the sum of its counts over the sum of its
 * denominators, because the counts are what is converted and summed.
 *
 * The numerator is the default view's value of the count, area by area: the
 * series the view prefers wins, so a converted count is used only where
 * nothing better is held. Each winning numerator series gives one `derived`
 * series of the rate, holding the areas and periods it won, in the same
 * dataset, with `derived_from_id` the numerator series. Written after the
 * default view and before it is written again, so the rates are ranked with
 * the rest: a rate the publisher released on the same boundaries is preferred
 * to a rebuilt one, and a rebuilt one to a converted one.
 *
 * The denominator is the population of the same area in the calendar year of
 * the middle of the numerator's period. Where that year is not held the latest
 * earlier year is used and `rate_input.earlier_year` says so. A later year is
 * never used.
 *
 * - All ages: the default view's population total on the release, the value a
 *   reader of the view sees. A dataset in `NOT_A_YEAR_ESTIMATE` is skipped.
 * - An age range: the sum of the single years of age (sex all) of one
 *   population series group: the first dataset, in the population dataset
 *   order, that holds a value for every age in the range for the area and
 *   year. A series group is one dataset's single-year series on the release
 *   from one source release, so a value is never summed across two sources.
 *
 * `rate_input` holds, for every rate value, both counts, where and when the
 * denominator came from, and the accuracy of each against the release's
 * boundaries; the rate's accuracy is the worse of the two.
 */

/**
 * Population datasets the default view may take a total from whose period is
 * not the year the people were counted in, so a rate would put a count over
 * the wrong year's residents.
 */
export const NOT_A_YEAR_ESTIMATE: Readonly<Record<string, string>> = {
	imd: "Holds the denominators of the Indices of Deprivation under the edition year: the 2025 edition's population was counted at mid-2022.",
};

/** The population datasets in the order an age range is taken from. */
const AGE_DATASET_ORDER = [
	"population-lsoa",
	"population-data-zone-scotland",
	"population-data-zone-ni",
	"population",
	"population-council-scotland",
	"population-district-ni",
	"population-uk",
	"population-constituency",
];

const accuracyCheck = (column: string) =>
	`${column} TEXT NOT NULL CHECK (${column} IN (${ACCURACIES.map((a) => `'${a}'`).join(", ")}))`;

/**
 * Creates `rate_input` when it is missing, so the change table can read it
 * on an atlas with no rebuilt rates. A function, not a constant: the change
 * table imports it and this module imports `ACCURACIES` from there.
 *
 * `denominator_dataset_id` has no foreign key: the population dataset may be
 * in another module than the rate, as with `core_denominator`. For the same
 * reason `series_input` names only the numerator.
 */
export const ensureRateTables = (database: DatabaseSync) =>
	database.exec(`
CREATE TABLE IF NOT EXISTS rate_input (
	series_id INTEGER NOT NULL REFERENCES series(id),
	area_version_id INTEGER NOT NULL REFERENCES area_version(id),
	period_id INTEGER NOT NULL REFERENCES period(id),
	numerator REAL NOT NULL,
	denominator REAL NOT NULL CHECK (denominator > 0),
	denominator_dataset_id INTEGER NOT NULL,
	denominator_period_id INTEGER NOT NULL REFERENCES period(id),
	earlier_year INTEGER NOT NULL CHECK (earlier_year IN (0, 1)),
	${accuracyCheck("numerator_accuracy")},
	${accuracyCheck("denominator_accuracy")},
	${accuracyCheck("accuracy")},
	PRIMARY KEY (series_id, area_version_id, period_id)
) WITHOUT ROWID, STRICT;`);

type Accuracy = (typeof ACCURACIES)[number];

const worse = (a: Accuracy, b: Accuracy): Accuracy =>
	ACCURACIES.indexOf(a) >= ACCURACIES.indexOf(b) ? a : b;

/**
 * How far an observation is from a value published on these boundaries. A
 * published series is `published` whatever the publisher's own status, an
 * estimated value of anything else is `estimated`, and an exact regrouping
 * or a sum is `regrouped`.
 */
const accuracySql = (series: string, observation: string) => `CASE
    WHEN ${series}.method = 'published' THEN 'published'
    WHEN ${series}.method = 'modelled' THEN 'modelled'
    WHEN ${observation}.status_id = (SELECT id FROM status WHERE slug = 'estimated') THEN 'estimated'
    ELSE 'regrouped' END`;

/** Winning rows of the default view for a measure, read from its tables. */
const winners = (measure: string, extra = "") => `
SELECT sp.series_id, s.dataset_id, s.release_id, o.area_version_id, o.period_id,
  o.value, ${accuracySql("s", "o")} AS accuracy, p.start_date, p.end_date
FROM quantity q
JOIN series_preference sp ON sp.quantity_id = q.id
JOIN series s ON s.id = sp.series_id
JOIN observation o ON o.series_id = sp.series_id
JOIN period p ON p.id = o.period_id
WHERE q.measure_id = (SELECT id FROM measure WHERE slug = '${measure}')
  AND NOT EXISTS (
    SELECT 1 FROM series_preference better
    JOIN observation ob ON ob.series_id = better.series_id
      AND ob.area_version_id = o.area_version_id AND ob.period_id = o.period_id
    WHERE better.quantity_id = sp.quantity_id AND better.rank < sp.rank)
  AND o.value IS NOT NULL${extra}`;

/** The calendar year of the middle of a period. */
export const midpointYear = (start: string, end: string): number => {
	const middle =
		(Date.parse(`${start}T00:00:00Z`) + Date.parse(`${end}T00:00:00Z`)) / 2;
	return new Date(middle).getUTCFullYear();
};

type Denominator = {
	value: number;
	datasetId: number;
	periodId: number;
	accuracy: Accuracy;
};

/** By area version, then year: the denominator held for that year. */
type Denominators = Map<number, Map<number, Denominator>>;

const put = (
	into: Denominators,
	area: number,
	year: number,
	value: Denominator,
) => {
	let years = into.get(area);
	if (!years) into.set(area, (years = new Map()));
	if (!years.has(year)) years.set(year, value);
};

/** The denominator for a year, or the latest earlier one held. */
export const denominatorFor = (
	years: ReadonlyMap<number, Denominator> | undefined,
	year: number,
): { denominator: Denominator; year: number } | undefined => {
	if (!years) return undefined;
	let best: number | undefined;
	for (const held of years.keys())
		if (held <= year && (best === undefined || held > best)) best = held;
	return best === undefined
		? undefined
		: { denominator: years.get(best)!, year: best };
};

const allAges = (database: DatabaseSync, releases: number[]): Denominators => {
	const result: Denominators = new Map();
	const skip = Object.keys(NOT_A_YEAR_ESTIMATE)
		.map((slug) => `'${slug}'`)
		.join(", ");
	const rows = database
		.prepare(
			`${winners(
				"population",
				`
  AND q.key = (SELECT 'population/' || r.geography || ':' || r.release FROM area_release r WHERE r.id = q.release_id)
  AND q.release_id IN (${releases.join(", ")})
  AND s.dataset_id NOT IN (SELECT id FROM dataset WHERE slug IN (${skip}))
  AND p.kind = 'year' AND o.value > 0`,
			)}`,
		)
		.all() as Array<{
		series_id: number;
		dataset_id: number;
		area_version_id: number;
		period_id: number;
		value: number;
		accuracy: Accuracy;
		start_date: string;
		end_date: string;
	}>;
	for (const row of rows)
		put(
			result,
			row.area_version_id,
			midpointYear(row.start_date, row.end_date),
			{
				value: row.value,
				datasetId: row.dataset_id,
				periodId: row.period_id,
				accuracy: row.accuracy,
			},
		);
	return result;
};

const ageRange = (
	database: DatabaseSync,
	releases: number[],
	age: NonNullable<DenominatorReference["filter"]["age"]>,
): Denominators => {
	const top = Number(
		(
			database
				.prepare(
					"SELECT max(CAST(dm.code AS INTEGER)) AS top FROM dimension_member dm JOIN dimension d ON d.id = dm.dimension_id WHERE d.slug = 'age' AND dm.code GLOB '[0-9]*'",
				)
				.get() as { top: number | null }
		).top ?? -1,
	);
	const to = age.to ?? top;
	if (to > top || age.from > to) return new Map();
	const ages = to - age.from + 1;
	const order = AGE_DATASET_ORDER.map(
		(slug, rank) => `WHEN '${slug}' THEN ${rank}`,
	).join(" ");
	const rows = database
		.prepare(
			`WITH single AS (
  SELECT s.id AS series_id, s.dataset_id, s.method, coalesce(f.release_id, s.release_id) AS source_release_id,
    CAST(am.code AS INTEGER) AS age
  FROM series s
  LEFT JOIN series f ON f.id = s.derived_from_id
  JOIN series_member a ON a.series_id = s.id
    AND a.dimension_id = (SELECT id FROM dimension WHERE slug = 'age')
  JOIN dimension_member am ON am.id = a.member_id
  JOIN series_member x ON x.series_id = s.id
    AND x.dimension_id = (SELECT id FROM dimension WHERE slug = 'sex')
  JOIN dimension_member xm ON xm.id = x.member_id AND xm.code = 'all'
  WHERE s.measure_id = (SELECT id FROM measure WHERE slug = 'population')
    AND s.release_id IN (${releases.join(", ")})
    AND (SELECT count(*) FROM series_member n WHERE n.series_id = s.id) = 2
    AND am.code GLOB '[0-9]*'
    AND CAST(am.code AS INTEGER) BETWEEN ${age.from} AND ${to})
SELECT g.dataset_id, g.method, g.source_release_id, o.area_version_id, o.period_id,
  p.start_date, p.end_date, sum(o.value) AS value,
  max(CASE ${ACCURACIES.map((a, rank) => `WHEN ${accuracySql("s", "o")} = '${a}' THEN ${rank}`).join(" ")} END) AS accuracy
FROM single g
JOIN series s ON s.id = g.series_id
JOIN observation o ON o.series_id = g.series_id
JOIN period p ON p.id = o.period_id AND p.kind = 'year'
JOIN dataset d ON d.id = g.dataset_id
WHERE o.value IS NOT NULL
GROUP BY g.dataset_id, g.method, g.source_release_id, o.area_version_id, o.period_id
HAVING count(*) = ${ages} AND count(DISTINCT g.age) = ${ages} AND sum(o.value) > 0
ORDER BY CASE g.method WHEN 'published' THEN 0 ELSE 1 END,
  CASE (SELECT slug FROM dataset WHERE id = g.dataset_id) ${order} ELSE ${AGE_DATASET_ORDER.length} END,
  g.source_release_id DESC`,
		)
		.all() as Array<{
		dataset_id: number;
		area_version_id: number;
		period_id: number;
		start_date: string;
		end_date: string;
		value: number;
		accuracy: number;
	}>;
	const result: Denominators = new Map();
	for (const row of rows)
		put(
			result,
			row.area_version_id,
			midpointYear(row.start_date, row.end_date),
			{
				value: row.value,
				datasetId: row.dataset_id,
				periodId: row.period_id,
				accuracy: ACCURACIES[row.accuracy]!,
			},
		);
	return result;
};

export type CountRateSummary = {
	rate: string;
	series: number;
	values: number;
	/** Values whose denominator is from an earlier year. */
	earlier: number;
	/** Winning numerator values with no denominator held in or before their year. */
	unmatched: number;
};

/**
 * Writes the rebuilt rates as `derived` series and `rate_input`. Reads the
 * default view's tables, so it runs after `writeDefaultObservation`, and the
 * view must be written again after it for the rates to be ranked.
 */
export const writeCountRates = (
	database: DatabaseSync,
	ids: { series: { assign(key: string): number } },
	rates: typeof REBUILT_RATES = REBUILT_RATES,
): CountRateSummary[] => {
	ensureRateTables(database);
	const measureId = database.prepare("SELECT id FROM measure WHERE slug = ?");
	const insertSeries = database.prepare(
		"INSERT INTO series (id, dataset_id, measure_id, release_id, method, derived_from_id, key) VALUES (?, ?, ?, ?, 'derived', ?, ?)",
	);
	const insertInput = database.prepare(
		"INSERT OR IGNORE INTO series_input (series_id, input_series_id, role) VALUES (?, ?, ?)",
	);
	const insertObservation = database.prepare(
		"INSERT INTO observation (series_id, area_version_id, period_id, value, status_id) VALUES (?, ?, ?, ?, (SELECT id FROM status WHERE slug = 'derived'))",
	);
	const insertRateInput = database.prepare(
		"INSERT INTO rate_input VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
	);
	const seriesKey = database.prepare("SELECT key FROM series WHERE id = ?");
	const summaries: CountRateSummary[] = [];
	for (const [rate, { numerator, denominator, per }] of rates) {
		const rateId = (measureId.get(rate) as { id: number } | undefined)?.id;
		if (rateId === undefined || !measureId.get(numerator)) continue;
		const numerators = database.prepare(winners(numerator)).all() as Array<{
			series_id: number;
			dataset_id: number;
			release_id: number;
			area_version_id: number;
			period_id: number;
			value: number;
			accuracy: Accuracy;
			start_date: string;
			end_date: string;
		}>;
		const releases = [...new Set(numerators.map((row) => row.release_id))];
		const summary: CountRateSummary = {
			rate,
			series: 0,
			values: 0,
			earlier: 0,
			unmatched: 0,
		};
		summaries.push(summary);
		if (releases.length === 0) continue;
		const held = denominator.filter.age
			? ageRange(database, releases, denominator.filter.age)
			: allAges(database, releases);
		const written = new Map<number, number>();
		for (const row of numerators) {
			const year = midpointYear(row.start_date, row.end_date);
			const found = denominatorFor(held.get(row.area_version_id), year);
			if (!found) {
				summary.unmatched++;
				continue;
			}
			let id = written.get(row.series_id);
			if (id === undefined) {
				const from = (seriesKey.get(row.series_id) as { key: string })
					.key;
				id = ids.series.assign(`${from}~rate:${rate}`);
				insertSeries.run(
					id,
					row.dataset_id,
					rateId,
					row.release_id,
					row.series_id,
					`${from}~rate:${rate}`,
				);
				insertInput.run(id, row.series_id, "numerator");
				written.set(row.series_id, id);
				summary.series++;
			}
			const { denominator: d } = found;
			const earlier = found.year < year ? 1 : 0;
			insertObservation.run(
				id,
				row.area_version_id,
				row.period_id,
				(per * row.value) / d.value,
			);
			insertRateInput.run(
				id,
				row.area_version_id,
				row.period_id,
				row.value,
				d.value,
				d.datasetId,
				d.periodId,
				earlier,
				row.accuracy,
				d.accuracy,
				worse(row.accuracy, d.accuracy),
			);
			summary.values++;
			summary.earlier += earlier;
		}
	}
	return summaries;
};
