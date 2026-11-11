import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import {
	convertEntry,
	type ConversionContext,
	type SkipReason,
} from "../../src/conversion/convertSeries.ts";
import type { PlanEntry } from "../../src/conversion/convertedPlan.ts";
import type { Step, StepEdge } from "../../src/conversion/crosswalkSteps.ts";
import type { Resolver } from "../../src/conversion/pinnedRoutes.ts";
import {
	conversionRules,
	type MeasureRow,
} from "../../src/conversion/rules.ts";

/**
 * Source areas 1, 2 and 3 are on release 10. Areas 1 and 2 merge into 20 and
 * area 3 becomes 21, on release 11. Every edge is exact.
 */
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
	releaseId: (key: string) => (key === "area:from" ? 10 : 11),
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

const measure = (
	id: number,
	slug: string,
	fields: Partial<MeasureRow> = {},
): MeasureRow => ({
	id,
	slug,
	unit: "count",
	valueKind: "count",
	aggregation: "sum",
	numerator: null,
	denominator: null,
	weight: null,
	...fields,
});
const measures = [
	measure(1, "people"),
	measure(2, "employed"),
	measure(3, "employment-rate", {
		unit: "percent",
		valueKind: "share",
		aggregation: "ratio",
		numerator: "employed",
		denominator: "people",
	}),
	measure(4, "score", {
		unit: "score",
		valueKind: "mean",
		aggregation: "weighted_mean",
		weight: "people",
	}),
];

const database = new DatabaseSync(":memory:");
database.exec(`
	CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT, key TEXT);
	CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT, start_date TEXT);
	CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, status_id INTEGER);
	INSERT INTO dataset VALUES (1, 'labour');
	INSERT INTO period VALUES (1, '2024', '2024-01-01');
`);
let nextSeries = 0;
const publish = (
	measureId: number,
	slug: string,
	release: number,
	values: [number, number][],
) => {
	nextSeries += 1;
	database.exec(
		`INSERT OR IGNORE INTO measure VALUES (${measureId}, '${slug}')`,
	);
	database.exec(
		`INSERT INTO series VALUES (${nextSeries}, 1, ${measureId}, ${release}, 'published', 'labour/${slug}/area:${release === 10 ? "from" : "to"}')`,
	);
	for (const [area, value] of values)
		database.exec(
			`INSERT INTO observation VALUES (${nextSeries}, ${area}, 1, ${value}, 1)`,
		);
};
publish(1, "people", 10, [
	[1, 100],
	[2, 300],
	[3, 50],
]);
publish(2, "employed", 10, [
	[1, 50],
	[2, 150],
	[3, 10],
]);
publish(3, "employment-rate", 10, [
	[1, 50],
	[2, 50],
	[3, 20],
]);
publish(4, "score", 10, [
	[1, 10],
	[2, 20],
	[3, 7],
]);

const entry = (measureSlug: string): PlanEntry => ({
	id: `labour/${measureSlug}`,
	source: { dataset: "labour", measure: measureSlug, release: "area:from" },
	target: "area:to",
	route: [{ crosswalks: ["merge"] }],
});

const skips: [string, SkipReason][] = [];
const context = (): ConversionContext => ({
	database,
	resolver,
	rules: new Map(
		conversionRules(measures).map(({ measure, rule }) => [
			measure.slug,
			rule,
		]),
	),
	factors: () => undefined,
	skipped: (planned, source, reason) =>
		skips.push([`${planned.id}|${source.key}`, reason]),
});

const converted = (slug: string) => [...convertEntry(context(), entry(slug))];
const byArea = (series: ReturnType<typeof converted>[number]) =>
	new Map(series.observations.map((o) => [o.area, o.value]));

test("a count is summed over the areas that merge", () => {
	const [series] = converted("people");
	assert.equal(series!.rule, "sum");
	assert.deepEqual(
		[...byArea(series!)],
		[
			[20, 400],
			[21, 50],
		],
	);
	assert.deepEqual(series!.quality, { exactShare: 1, coverage: 1 });
	assert.ok(series!.observations.every((o) => o.status === 6));
	assert.equal(series!.key, "labour/people/area:from~converted:area:to");
});

test("a ratio is rebuilt from its converted parts, not averaged", () => {
	const [series] = converted("employment-rate");
	assert.equal(series!.rule, "rebuild");
	const values = byArea(series!);
	// 200 over 400 is 50%, where the mean of 50% and 50% would also be 50%.
	// Area 21 is 10 over 50, not the published 20.
	assert.equal(values.get(20), 50);
	assert.equal(values.get(21), 20);
	assert.deepEqual(
		series!.inputs.map((input) => input.role),
		["numerator", "denominator"],
	);
});

test("a mean is rebuilt over the weight it names", () => {
	const [series] = converted("score");
	const values = byArea(series!);
	// (10 * 100 + 20 * 300) / 400 = 17.5, where the plain mean would be 15.
	assert.equal(values.get(20), 17.5);
	assert.equal(values.get(21), 7);
	assert.deepEqual(
		series!.inputs.map((input) => input.role),
		["value", "weight"],
	);
});

test("a source the target already publishes is skipped", () => {
	publish(1, "people", 11, [[20, 1]]);
	skips.length = 0;
	assert.deepEqual(converted("people"), []);
	assert.deepEqual(skips, [
		["labour/people|labour/people/area:from", "published-on-target"],
	]);
});

test("a ratio without its published denominator is skipped, not guessed", () => {
	database.exec(
		"DELETE FROM series WHERE measure_id = 1 AND release_id = 10",
	);
	skips.length = 0;
	assert.deepEqual(converted("employment-rate"), []);
	assert.deepEqual(skips, [
		[
			"labour/employment-rate|labour/employment-rate/area:from",
			"missing-component",
		],
	]);
});
