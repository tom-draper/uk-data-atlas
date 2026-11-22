import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import {
	convertEntry,
	totalKey,
	type ConversionContext,
	type SkipReason,
} from "../../src/conversion/convertSeries.ts";
import { PERSONS, type PlanEntry } from "../../src/conversion/convertedPlan.ts";
import type { Step, StepEdge } from "../../src/conversion/crosswalkSteps.ts";
import type { Resolver } from "../../src/conversion/pinnedRoutes.ts";
import {
	conversionRules,
	type MeasureRow,
} from "../../src/conversion/rules.ts";
import type { SeriesRow } from "../../src/conversion/seriesValues.ts";

/** Areas 1 and 2 on release 10 merge into 20 on release 11; 3 becomes 21. */
const edge = (to: number): StepEdge => ({
	to,
	weight: 1,
	risk: 0,
	pruned: 0,
	crosswalk: 1,
});
const step: Step = {
	fromRelease: 10,
	toRelease: 11,
	crosswalks: [
		{
			id: 1,
			slug: "merge",
			method: "extent-continuity",
			purpose: null,
			fromRelease: 10,
			toRelease: 11,
		},
	],
	reversed: false,
	edges: new Map([
		[1, [edge(20)]],
		[2, [edge(20)]],
		[3, [edge(21)]],
	]),
	blocked: new Map(),
	feeders: new Map([
		[20, [1, 2]],
		[21, [3]],
	]),
};
const resolver = {
	releaseId: (key: string) => (key === "ward:from" ? 10 : 11),
	crosswalkId: () => 1,
	router: {
		hop: () => ({
			fromRelease: 10,
			toRelease: 11,
			crosswalks: [1],
			reversed: false,
			exact: true,
		}),
		step: () => step,
		crosswalk: () => step.crosswalks[0],
	},
} as unknown as Resolver;

const measure = (id: number, slug: string, fields: Partial<MeasureRow> = {}) =>
	({
		id,
		slug,
		unit: "count",
		statistic: "count",
		aggregation: "sum",
		numerator: null,
		denominator: null,
		weight: null,
		...fields,
	}) as MeasureRow;
const rules = new Map(
	conversionRules([
		measure(1, "population"),
		measure(2, "mean-age", {
			unit: "years",
			statistic: "mean",
			aggregation: "weighted_mean",
			weight: "population",
		}),
	]).map(({ measure, rule }) => [measure.slug, rule]),
);

const database = new DatabaseSync(":memory:");
database.exec(`
	CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT, key TEXT);
	CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT, start_date TEXT);
	CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, status_id INTEGER);
	INSERT INTO dataset VALUES (1, 'population'), (2, 'population-uk');
	INSERT INTO measure VALUES (1, 'population'), (2, 'mean-age');
	INSERT INTO period VALUES (1, '2015', '2015-06-30'), (2, '2022', '2022-06-30');
`);
let nextSeries = 0;
const publish = (
	dataset: number,
	members: string,
	release: number,
	values: [area: number, period: number, value: number, status?: number][],
	measureId = 1,
) => {
	nextSeries += 1;
	const slug = measureId === 1 ? "population" : "mean-age";
	database.exec(
		`INSERT INTO series VALUES (${nextSeries}, ${dataset}, ${measureId}, ${release}, 'published', 'population/${slug}/ward:${release === 10 ? "from" : "to"}${members ? `/${members}` : ""}')`,
	);
	for (const [area, period, value, status] of values)
		database.exec(
			`INSERT INTO observation VALUES (${nextSeries}, ${area}, ${period}, ${value}, ${status ?? 1})`,
		);
	return nextSeries;
};
// Two single years of age for persons, and one for males that is left out.
publish(1, "age=0/sex=all", 10, [
	[1, 1, 10],
	[2, 1, 20],
	[3, 1, 5],
	[1, 2, 11],
	[2, 2, 21],
	[3, 2, 6],
]);
publish(1, "age=1/sex=all", 10, [
	[1, 1, 100],
	[2, 1, 200, 3],
	[3, 1, 50],
	[1, 2, 101],
	[2, 2, 201],
	[3, 2, 51],
]);
publish(1, "age=0/sex=male", 10, [[1, 1, 1000]]);

const entry = (measureSlug = "population"): PlanEntry => ({
	id: `population/${measureSlug}#total`,
	source: {
		dataset: "population",
		measure: measureSlug,
		release: "ward:from",
	},
	target: "ward:to",
	route: [{ crosswalks: ["merge"] }],
	basis: "population",
	members: PERSONS,
	estimates: true,
	total: true,
});
const skips: [string, SkipReason][] = [];
const context: ConversionContext = {
	database,
	resolver,
	rules,
	factors: () => undefined,
	skipped: (planned, source, reason) => skips.push([source.key, reason]),
};
const converted = (slug?: string) => [...convertEntry(context, entry(slug))];

test("the key of a total keeps only the members every part shares", () => {
	const part = (key: string) =>
		({ key, members: key.split("/").slice(3).join("/") }) as SeriesRow;
	assert.equal(
		totalKey([
			part("population/population/ward:2023/age=0/sex=all"),
			part("population/population/ward:2023/age=1/sex=all"),
		]),
		"population/population/ward:2023/sex=all",
	);
	assert.equal(
		totalKey([part("population/population/ward:2023/age=0/sex=all")]),
		"population/population/ward:2023/age=0/sex=all",
	);
	assert.throws(() => totalKey([]));
});

test("the persons of every age are added up into one converted total", () => {
	const series = converted();
	assert.equal(series.length, 1);
	const [total] = series;
	assert.equal(
		total!.key,
		"population/population/ward:from/sex=all~converted:ward:to",
	);
	assert.equal(total!.rule, "sum");
	assert.deepEqual(
		total!.inputs.map((input) => [input.role, input.series.members]),
		[
			["value", "age=0/sex=all"],
			["value", "age=1/sex=all"],
		],
	);
	assert.deepEqual(
		total!.observations.map((o) => [o.area, o.period, o.value, o.status]),
		[
			[21, 1, 55, 6],
			[20, 2, 334, 6],
			[21, 2, 57, 6],
		],
	);
});

test("an area whose parts are not all observed is a missing input, not a short total", () => {
	const [total] = converted();
	// Area 2 has age=1 flagged in 2015, so area 20, which it feeds, has no
	// 2015 total rather than the total of area 1 alone.
	assert.ok(
		!total!.observations.some((o) => o.area === 20 && o.period === 1),
	);
	assert.deepEqual(
		total!.gaps.map((gap) => [gap.area, gap.period, gap.reason]),
		[[20, 1, "missing-input"]],
	);
});

test("an official figure on the target is kept and never converted over", () => {
	// Another dataset publishes 2022 for one age on the target release. That
	// is an official figure for the year, so only 2015 is converted.
	const official = publish(2, "age=5/sex=male", 11, [[20, 2, 1]]);
	skips.length = 0;
	const [total] = converted();
	assert.deepEqual(skips, []);
	assert.equal(total!.periods, 1);
	assert.ok(total!.observations.every((o) => o.period === 1));

	// With every year official, nothing is converted and each part is skipped.
	database.exec(`INSERT INTO observation VALUES (${official}, 20, 1, 1, 1)`);
	skips.length = 0;
	assert.deepEqual(converted(), []);
	assert.deepEqual(skips, [
		[
			"population/population/ward:from/age=0/sex=all",
			"published-on-target",
		],
		[
			"population/population/ward:from/age=1/sex=all",
			"published-on-target",
		],
	]);
	database.exec(`DELETE FROM observation WHERE series_id = ${official}`);
	database.exec(`DELETE FROM series WHERE id = ${official}`);
});

test("only a summed measure can be added up", () => {
	publish(1, "sex=all", 10, [[1, 1, 40]], 2);
	assert.throws(() => converted("mean-age"), /only a summed measure/);
});
