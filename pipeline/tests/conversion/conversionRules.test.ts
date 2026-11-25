import assert from "node:assert/strict";
import { test } from "vitest";
import {
	conversionRules,
	type MeasureRow,
} from "../../src/conversion/rules.ts";

const measure = (
	id: number,
	slug: string,
	fields: Partial<MeasureRow> = {},
): MeasureRow => ({
	id,
	slug,
	unit: "people",
	statistic: "count",
	aggregation: "sum",
	numerator: null,
	denominator: null,
	weight: null,
	...fields,
});

const ratio = (id: number, slug: string, fields: Partial<MeasureRow> = {}) =>
	measure(id, slug, {
		unit: "percent",
		statistic: "share",
		aggregation: "ratio",
		...fields,
	});

const rulesOf = (measures: MeasureRow[]) =>
	new Map(
		conversionRules(measures).map(({ measure, rule }) => [
			measure.slug,
			rule,
		]),
	);

test("an additive measure is summed, and split only where a split was backtested", () => {
	const rules = rulesOf([
		measure(1, "population"),
		measure(2, "households"),
		measure(3, "spend", { unit: "gbp", statistic: "total" }),
	]);
	const population = rules.get("population")!;
	assert.equal(population.rule, "sum");
	assert.equal(
		population.rule === "sum" && population.splitBasis,
		"population",
	);
	for (const slug of ["households", "spend"]) {
		const rule = rules.get(slug)!;
		assert.equal(rule.rule, "sum");
		assert.equal(rule.rule === "sum" && rule.splitBasis, null);
	}
});

test("a ratio is rebuilt from an additive numerator and denominator, or carried", () => {
	const rules = rulesOf([
		measure(1, "fuel-poor-households"),
		measure(2, "households"),
		measure(3, "median-income", {
			statistic: "median",
			aggregation: "none",
		}),
		ratio(4, "fuel-poverty-rate", {
			numerator: "fuel-poor-households",
			denominator: "households",
		}),
		ratio(5, "unnamed-rate"),
		ratio(6, "income-ratio", {
			numerator: "median-income",
			denominator: "households",
		}),
		ratio(7, "per-thousand", {
			unit: "per-1000",
			numerator: "fuel-poor-households",
			denominator: "households",
		}),
	]);
	assert.deepEqual(
		{ ...rules.get("fuel-poverty-rate")!, reason: "" },
		{
			rule: "rebuild",
			numerator: "fuel-poor-households",
			denominator: "households",
			scale: 100,
			reason: "",
		},
	);
	for (const [slug, said] of [
		["unnamed-rate", /does not name both/],
		["income-ratio", /median-income is not additive/],
		["per-thousand", /No ratio rebuild rule is supported/],
	] as const) {
		const rule = rules.get(slug)!;
		assert.equal(rule.rule, "carry");
		assert.match(rule.reason, said);
	}
});

test("a weighted mean is rebuilt over an additive weight it names, or carried", () => {
	const mean = { statistic: "mean", aggregation: "weighted_mean" };
	const rules = rulesOf([
		measure(1, "pupils"),
		measure(2, "median-income", {
			statistic: "median",
			aggregation: "none",
		}),
		measure(3, "attainment", { ...mean, weight: "pupils" }),
		measure(4, "progress", mean),
		measure(5, "by-income", { ...mean, weight: "median-income" }),
	]);
	assert.deepEqual(
		{ ...rules.get("attainment")!, reason: "" },
		{ rule: "rebuild", weight: "pupils", reason: "" },
	);
	for (const [slug, said] of [
		["progress", /no weight series is linked/],
		["by-income", /median-income is not additive/],
	] as const) {
		const rule = rules.get(slug)!;
		assert.equal(rule.rule, "carry");
		assert.match(rule.reason, said);
	}
});

test("a refusal names what is not held, or where the rate is rebuilt, where the measure has a specific reason", () => {
	const rules = rulesOf([
		measure(1, "claimant-rate", { statistic: "rate", aggregation: "none" }),
		measure(2, "band-d-council-tax", {
			statistic: "mean",
			aggregation: "weighted_mean",
		}),
	]);
	assert.match(rules.get("claimant-rate")!.reason, /rebuilds it.*countRates/);
	assert.match(
		rules.get("band-d-council-tax")!.reason,
		/no weight series is linked.*number of properties/,
	);
});

test("what cannot be combined is carried where unchanged, with the reason it is not combined", () => {
	const carried = [
		measure(1, "median-age", { statistic: "median", aggregation: "none" }),
		measure(5, "turnout", { statistic: "rate", aggregation: "none" }),
		measure(6, "mean-price", { statistic: "mean", aggregation: "none" }),
		measure(7, "attainment", {
			statistic: "mean",
			aggregation: "weighted_mean",
		}),
		// A count declared as not additive is not summed.
		measure(8, "distinct-count", { aggregation: "none" }),
	];
	const reasons = new Set<string>();
	for (const { rule } of conversionRules(carried)) {
		assert.equal(rule.rule, "carry");
		assert.match(rule.reason, /carried unchanged where one area/);
		reasons.add(rule.reason);
	}
	assert.equal(reasons.size, carried.length);
});

test("a value relative to the other areas of its release is refused", () => {
	const refused = [
		measure(2, "imd-rank", { statistic: "rank", aggregation: "none" }),
		measure(3, "imd-score", { statistic: "index", aggregation: "none" }),
		measure(4, "winner", { statistic: "category", aggregation: "none" }),
	];
	const reasons = new Set<string>();
	for (const { rule } of conversionRules(refused)) {
		assert.equal(rule.rule, "refuse");
		assert.ok(rule.reason.length > 20);
		reasons.add(rule.reason);
	}
	assert.equal(reasons.size, refused.length);
});

test("conversion never sums a non-additive statistic", () => {
	const rule = rulesOf([
		measure(1, "inconsistent", { statistic: "median" }),
	]).get("inconsistent")!;
	assert.notEqual(rule.rule, "sum");
});
