import assert from "node:assert/strict";
import { test } from "vitest";
import { conversionRules, type MeasureRow } from "../src/conversion/rules.ts";

const measure = (
	id: number,
	slug: string,
	fields: Partial<MeasureRow> = {},
): MeasureRow => ({
	id,
	slug,
	unit: "people",
	valueKind: "count",
	aggregation: "sum",
	numerator: null,
	denominator: null,
	...fields,
});

const ratio = (id: number, slug: string, fields: Partial<MeasureRow> = {}) =>
	measure(id, slug, {
		unit: "percent",
		valueKind: "share",
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
		measure(3, "spend", { unit: "gbp", valueKind: "amount" }),
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

test("a ratio is rebuilt from an additive numerator and denominator, or refused", () => {
	const rules = rulesOf([
		measure(1, "fuel-poor-households"),
		measure(2, "households"),
		measure(3, "median-income", {
			valueKind: "median",
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
		["per-thousand", /No scale is known/],
	] as const) {
		const rule = rules.get(slug)!;
		assert.equal(rule.rule, "refuse");
		assert.match(rule.reason, said);
	}
});

test("everything that is not additive or a rebuildable ratio is refused with a reason", () => {
	const refused = [
		measure(1, "median-age", { valueKind: "median", aggregation: "none" }),
		measure(2, "imd-rank", { valueKind: "rank", aggregation: "none" }),
		measure(3, "imd-score", { valueKind: "index", aggregation: "none" }),
		measure(4, "winner", { valueKind: "category", aggregation: "none" }),
		measure(5, "turnout", { valueKind: "rate", aggregation: "none" }),
		measure(6, "mean-price", { valueKind: "mean", aggregation: "none" }),
		measure(7, "attainment", {
			valueKind: "mean",
			aggregation: "weighted_mean",
		}),
		// A count declared as not additive is not summed.
		measure(8, "distinct-count", { aggregation: "none" }),
	];
	const reasons = new Set<string>();
	for (const { rule } of conversionRules(refused)) {
		assert.equal(rule.rule, "refuse");
		assert.ok(rule.reason.length > 20);
		reasons.add(rule.reason);
	}
	assert.equal(reasons.size, refused.length);
});
