import assert from "node:assert/strict";
import { test } from "vitest";
import type { StatisticsMeasure } from "@uk-data-atlas/measures";
import { MEASURE_UNITS, measureSemantics } from "@uk-data-atlas/datasets";
import { validateMeasureSemantics } from "../../src/storage/validateMeasureSemantics.ts";

const base: StatisticsMeasure = {
	slug: "fixture",
	label: "Fixture",
	description: "Fixture",
	unit: "people",
	valueKind: "count",
	aggregation: "sum",
};

test("validation rejects incomplete or inconsistent measure metadata", () => {
	for (const [changes, message] of [
		[{ aggregation: "ratio" }, /numerator and denominator/],
		[{ aggregation: "weighted_mean" }, /requires a weight/],
		[{ unit: "missing" }, /unknown unit/],
		[
			{ valueKind: "share", unit: "people", aggregation: "none" },
			/share requires/,
		],
		[{ unit: "percent", aggregation: "none" }, /percent unit/],
		[{ valueKind: "median" }, /sum is incompatible/],
	] as const)
		assert.throws(
			() => validateMeasureSemantics({ ...base, ...changes }),
			message,
		);
});

test("pay names its statistic dimension and missing-weight exceptions stay specific", () => {
	assert.deepEqual(
		measureSemantics({
			...base,
			slug: "gross-annual-pay",
			valueKind: "amount",
			aggregation: "none",
		}).statisticDimension,
		"pay-statistic",
	);
	assert.doesNotThrow(() =>
		validateMeasureSemantics({
			...base,
			slug: "progress-8",
			unit: "score",
			valueKind: "mean",
			aggregation: "weighted_mean",
		}),
	);
	assert.throws(
		() =>
			validateMeasureSemantics({
				...base,
				slug: "another-mean",
				unit: "score",
				valueKind: "mean",
				aggregation: "weighted_mean",
			}),
		/requires a weight/,
	);
});

test("unit scales distinguish percent and per-thousand values", () => {
	assert.equal(
		MEASURE_UNITS.find((unit) => unit.label === "percent")?.scale,
		100,
	);
	assert.equal(
		MEASURE_UNITS.find((unit) => unit.label === "per 1,000 households")
			?.scale,
		1000,
	);
	assert.equal(
		MEASURE_UNITS.find((unit) => unit.label === "gbp million")?.scale,
		1_000_000,
	);
});
