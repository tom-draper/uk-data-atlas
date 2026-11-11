import { mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { IdRegistries } from "../ids/idRegistries.ts";
import type { ConvertedSeries } from "./convertSeries.ts";
import type { ConversionRule, MeasureRow } from "./rules.ts";
import { BACKTEST_SCHEMA, BACKTEST_TABLES } from "./storeBacktest.ts";

/**
 * The `converted-series` component, and its copy into `atlas.sqlite`.
 *
 * The component numbers its series itself (`n`). They take their `series.id`
 * from the id registry when `assemble-atlas` copies them in, as every other
 * series does.
 */

/** The references are left out of the component, which holds no table to refer to. */
const measureConversion = (measure = "", basis = "") => `
CREATE TABLE measure_conversion (
	measure_id INTEGER PRIMARY KEY${measure},
	rule TEXT NOT NULL CHECK (rule IN ('sum','rebuild','refuse')),
	-- The one weight basis a split of the measure may be estimated on.
	split_basis_id TEXT${basis},
	reason TEXT NOT NULL) STRICT;
`;

/**
 * Why a published series was not converted onto a standard release. One row
 * for each dataset, measure, source release, target release and reason, with
 * the number of series it covers. A measure refused outright has its reason
 * in `measure_conversion` and a row here for each target it was offered.
 */
const conversionSkip = (release = "", dataset = "", measure = "") => `
CREATE TABLE conversion_skip (
	dataset_id INTEGER NOT NULL${dataset},
	measure_id INTEGER NOT NULL${measure},
	source_release_id INTEGER NOT NULL${release},
	target_release_id INTEGER NOT NULL${release},
	reason TEXT NOT NULL CHECK (reason IN ('refused-measure','no-route','published-on-target','missing-component','no-values')),
	series INTEGER NOT NULL CHECK (series > 0),
	PRIMARY KEY (dataset_id, measure_id, source_release_id, target_release_id, reason)) WITHOUT ROWID, STRICT;
`;

export const CONVERTED_COMPONENT_SCHEMA = `
CREATE TABLE converted_series (
	n INTEGER PRIMARY KEY, key TEXT NOT NULL UNIQUE, plan_id TEXT NOT NULL,
	dataset_id INTEGER NOT NULL, measure_id INTEGER NOT NULL, release_id INTEGER NOT NULL,
	rule TEXT NOT NULL, basis_id TEXT NOT NULL, exact INTEGER NOT NULL,
	exact_share REAL NOT NULL CHECK (exact_share BETWEEN 0 AND 1),
	coverage REAL NOT NULL CHECK (coverage BETWEEN 0 AND 1), note TEXT,
	check_compared INTEGER, check_max_difference REAL) STRICT;
CREATE TABLE converted_input (
	n INTEGER NOT NULL, position INTEGER NOT NULL, role TEXT NOT NULL,
	input_series_id INTEGER NOT NULL, input_key TEXT NOT NULL,
	PRIMARY KEY (n, position)) WITHOUT ROWID, STRICT;
CREATE TABLE converted_crosswalk (
	n INTEGER NOT NULL, position INTEGER NOT NULL,
	crosswalk_id INTEGER NOT NULL, slug TEXT NOT NULL, reversed INTEGER NOT NULL,
	PRIMARY KEY (n, position)) WITHOUT ROWID, STRICT;
CREATE TABLE converted_observation (
	n INTEGER NOT NULL, area_version_id INTEGER NOT NULL, period_id INTEGER NOT NULL,
	value REAL NOT NULL, status_id INTEGER NOT NULL, lower REAL, upper REAL,
	PRIMARY KEY (n, area_version_id, period_id)) WITHOUT ROWID, STRICT;
CREATE TABLE converted_gap (
	n INTEGER NOT NULL, area_version_id INTEGER NOT NULL, period_id INTEGER NOT NULL,
	reason TEXT NOT NULL,
	PRIMARY KEY (n, area_version_id, period_id)) WITHOUT ROWID, STRICT;
${measureConversion()}
${conversionSkip()}
${BACKTEST_SCHEMA}
`;

/**
 * What `atlas.sqlite` holds about a converted series beside its `series` row
 * and its observations.
 *
 * - `series_input`: the published series it was computed from.
 * - `series_conversion`: its rule and weight basis. `exact` is 1 where every
 *   value is an exact regrouping and 0 where some are estimated splits.
 *   `exact_share` is the share of the series' value that reached its area by
 *   regrouping whole source areas, and `coverage` the share of the target
 *   areas reached that hold a value. See `qualityOf` in `convertSeries.ts`.
 * - `series_crosswalk`: the crosswalks of its route, in order.
 * - `series_gap`: the areas it has no value for, and why. The area is one of
 *   the series' own release, except where the reason is `not-carried`, when
 *   it is the source area whose value no crosswalk carried.
 * - `measure_conversion`: the rule of every measure, with the reason a
 *   refused one is refused.
 * - `conversion_skip`: the published series left out of a standard release,
 *   and why.
 */
export const ATLAS_CONVERSION_SCHEMA = `
CREATE TABLE series_input (
	series_id INTEGER NOT NULL REFERENCES series(id),
	input_series_id INTEGER NOT NULL REFERENCES series(id),
	role TEXT NOT NULL CHECK (role IN ('value','numerator','denominator','weight')),
	PRIMARY KEY (series_id, role)) WITHOUT ROWID, STRICT;
CREATE TABLE series_conversion (
	series_id INTEGER PRIMARY KEY REFERENCES series(id),
	rule TEXT NOT NULL CHECK (rule IN ('sum','rebuild')),
	basis_id TEXT NOT NULL REFERENCES weight_basis(id),
	exact INTEGER NOT NULL CHECK (exact IN (0, 1)),
	exact_share REAL NOT NULL CHECK (exact_share BETWEEN 0 AND 1),
	coverage REAL NOT NULL CHECK (coverage BETWEEN 0 AND 1),
	note TEXT) STRICT;
CREATE TABLE series_crosswalk (
	series_id INTEGER NOT NULL REFERENCES series(id),
	position INTEGER NOT NULL,
	crosswalk_id INTEGER NOT NULL REFERENCES crosswalk(id),
	reversed INTEGER NOT NULL CHECK (reversed IN (0, 1)),
	PRIMARY KEY (series_id, position)) WITHOUT ROWID, STRICT;
CREATE TABLE series_gap (
	series_id INTEGER NOT NULL REFERENCES series(id),
	area_version_id INTEGER NOT NULL REFERENCES area_version(id),
	period_id INTEGER NOT NULL REFERENCES period(id),
	reason TEXT NOT NULL,
	PRIMARY KEY (series_id, area_version_id, period_id)) WITHOUT ROWID, STRICT;
${measureConversion(" REFERENCES measure(id)", " REFERENCES weight_basis(id)")}
${conversionSkip(" REFERENCES area_releases(id)", " REFERENCES dataset(id)", " REFERENCES measure(id)")}
${BACKTEST_SCHEMA}
`;

export type RuledMeasure = { measure: MeasureRow; rule: ConversionRule };

export const writeMeasureConversions = (
	database: DatabaseSync,
	rules: readonly RuledMeasure[],
) => {
	const insert = database.prepare(
		"INSERT INTO measure_conversion VALUES (?,?,?,?)",
	);
	for (const { measure, rule } of rules)
		insert.run(
			measure.id,
			rule.rule,
			rule.rule === "sum" ? rule.splitBasis : null,
			rule.reason,
		);
};

export type SkipRow = {
	datasetId: number;
	measureId: number;
	sourceReleaseId: number;
	targetReleaseId: number;
	reason: string;
	series: number;
};

export const writeSkips = (
	database: DatabaseSync,
	skips: readonly SkipRow[],
) => {
	const insert = database.prepare(
		"INSERT INTO conversion_skip VALUES (?,?,?,?,?,?)",
	);
	for (const skip of skips)
		insert.run(
			skip.datasetId,
			skip.measureId,
			skip.sourceReleaseId,
			skip.targetReleaseId,
			skip.reason,
			skip.series,
		);
};

/** Writes series one at a time, so no more than one is held in memory. */
export const openConvertedWriter = (path: string) => {
	mkdirSync(dirname(path), { recursive: true });
	const temporary = `${path}.tmp`;
	rmSync(temporary, { force: true });
	const database = new DatabaseSync(temporary);
	database.exec(`${CONVERTED_COMPONENT_SCHEMA}; BEGIN`);
	const series = database.prepare(
		"INSERT INTO converted_series VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
	);
	const input = database.prepare(
		"INSERT INTO converted_input VALUES (?,?,?,?,?)",
	);
	const crosswalk = database.prepare(
		"INSERT INTO converted_crosswalk VALUES (?,?,?,?,?)",
	);
	const observation = database.prepare(
		"INSERT INTO converted_observation VALUES (?,?,?,?,?,?,?)",
	);
	const gap = database.prepare("INSERT INTO converted_gap VALUES (?,?,?,?)");
	let n = 0;
	return {
		database,
		add(converted: ConvertedSeries) {
			n += 1;
			series.run(
				n,
				converted.key,
				converted.planId,
				converted.datasetId,
				converted.measureId,
				converted.releaseId,
				converted.rule,
				converted.basis,
				converted.observations.every((o) => o.lower === null) ? 1 : 0,
				converted.quality.exactShare,
				converted.quality.coverage,
				converted.note,
				converted.sourceCheck?.compared ?? null,
				converted.sourceCheck?.maxDifference ?? null,
			);
			for (const [position, entry] of converted.inputs.entries())
				input.run(
					n,
					position,
					entry.role,
					entry.series.id,
					entry.series.key,
				);
			for (const c of converted.crosswalks)
				crosswalk.run(n, c.position, c.id, c.slug, c.reversed ? 1 : 0);
			for (const o of converted.observations)
				observation.run(
					n,
					o.area,
					o.period,
					o.value,
					o.status,
					o.lower,
					o.upper,
				);
			for (const g of converted.gaps)
				gap.run(n, g.area, g.period, g.reason);
		},
		finish() {
			database.exec("COMMIT");
			database.close();
			renameSync(temporary, path);
		},
		abandon() {
			database.close();
			rmSync(temporary, { force: true });
		},
	};
};

type ComponentSeries = {
	n: number;
	key: string;
	dataset_id: number;
	measure_id: number;
	release_id: number;
	rule: string;
	basis_id: string;
	exact: number;
	exact_share: number;
	coverage: number;
	note: string | null;
};

/**
 * Copies the component attached as `converted_component` into the database.
 * Returns how many series and observations it added.
 *
 * An input must still be the published series the component was computed
 * from, and a crosswalk the one it was routed through, or the copy fails: the
 * component was built for another base.
 */
export const copyConvertedSeries = (
	database: DatabaseSync,
	ids: IdRegistries,
) => {
	database.exec(ATLAS_CONVERSION_SCHEMA);
	const stale = (what: string) =>
		new Error(
			`The converted series were computed from another ${what}: rebuild converted-series`,
		);
	const mismatched = database
		.prepare(
			`SELECT count(*) AS n FROM converted_component.converted_crosswalk c
			LEFT JOIN crosswalk x ON x.id = c.crosswalk_id AND x.slug = c.slug
			WHERE x.id IS NULL`,
		)
		.get() as { n: number };
	if (mismatched.n > 0) throw stale("set of crosswalks");
	const inputs = database.prepare(
		`SELECT i.role, i.input_series_id AS id, s.id AS found
		FROM converted_component.converted_input i
		LEFT JOIN series s ON s.id = i.input_series_id AND s.key = i.input_key AND s.method = 'published'
		WHERE i.n = ? ORDER BY i.position`,
	);
	const insertSeries = database.prepare(
		"INSERT INTO series (id, dataset_id, measure_id, release_id, method, derived_from_id, key) VALUES (?,?,?,?,'converted',?,?)",
	);
	const insertMembers = database.prepare(
		"INSERT INTO series_member (series_id, dimension_id, member_id) SELECT ?, dimension_id, member_id FROM series_member WHERE series_id = ?",
	);
	const insertInput = database.prepare(
		"INSERT INTO series_input VALUES (?,?,?)",
	);
	const insertConversion = database.prepare(
		"INSERT INTO series_conversion VALUES (?,?,?,?,?,?,?)",
	);
	const insertCrosswalks = database.prepare(
		"INSERT INTO series_crosswalk SELECT ?, position, crosswalk_id, reversed FROM converted_component.converted_crosswalk WHERE n = ?",
	);
	const insertObservations = database.prepare(
		`INSERT INTO observation (series_id, area_version_id, period_id, value, status_id, lower, upper)
		SELECT ?, area_version_id, period_id, value, status_id, lower, upper
		FROM converted_component.converted_observation WHERE n = ?`,
	);
	const insertGaps = database.prepare(
		"INSERT INTO series_gap SELECT ?, area_version_id, period_id, reason FROM converted_component.converted_gap WHERE n = ?",
	);
	let series = 0;
	let observations = 0;
	for (const row of database
		.prepare(
			"SELECT * FROM converted_component.converted_series ORDER BY n",
		)
		.all() as ComponentSeries[]) {
		const from = inputs.all(row.n) as {
			role: string;
			id: number;
			found: number | null;
		}[];
		if (from.length === 0 || from.some((input) => input.found === null))
			throw stale("set of published series");
		const id = ids.series.assign(row.key);
		insertSeries.run(
			id,
			row.dataset_id,
			row.measure_id,
			row.release_id,
			from[0]!.id,
			row.key,
		);
		insertMembers.run(id, from[0]!.id);
		for (const input of from) insertInput.run(id, input.id, input.role);
		insertConversion.run(
			id,
			row.rule,
			row.basis_id,
			row.exact,
			row.exact_share,
			row.coverage,
			row.note,
		);
		insertCrosswalks.run(id, row.n);
		observations += Number(insertObservations.run(id, row.n).changes);
		insertGaps.run(id, row.n);
		series += 1;
	}
	for (const table of [
		"measure_conversion",
		"conversion_skip",
		...BACKTEST_TABLES,
	])
		database.exec(
			`INSERT INTO main.${table} SELECT * FROM converted_component.${table}`,
		);
	assertNothingPassesAsPublished(database);
	return { series, observations };
};

/**
 * Only a published series may hold an observed value. Everything derived from
 * one says so on each value, so a reader that ignores the series' method still
 * cannot take a converted figure for a published one.
 */
export const assertNothingPassesAsPublished = (database: DatabaseSync) => {
	const passing = database
		.prepare(
			`SELECT count(*) AS n FROM observation
			WHERE status_id = 1
				AND series_id IN (SELECT id FROM series WHERE method <> 'published')`,
		)
		.get() as { n: number };
	if (passing.n > 0)
		throw new Error(
			`${passing.n} values of series that are not published have the status of an observed value`,
		);
};
