import assert from "node:assert/strict";
import { test } from "vitest";
import type { StatisticsMeasure } from "@uk-data-atlas/measures";
import {
	COUNT_DENOMINATORS,
	MEASURE_UNITS,
	REBUILT_RATES,
	legacyValueKind,
	NOT_APPLICABLE_REASONS,
	measureSemantics,
} from "@uk-data-atlas/datasets";
import { validateMeasureSemantics } from "../../src/storage/validateMeasureSemantics.ts";

const base: StatisticsMeasure = {
	slug: "population",
	label: "Fixture",
	description: "Fixture",
	unit: "people",
	statistic: "count",
	aggregation: "sum",
};

test("validation rejects incomplete or inconsistent measure metadata", () => {
	for (const [changes, message] of [
		[{ aggregation: "ratio" }, /numerator and denominator/],
		[{ aggregation: "weighted_mean" }, /requires a weight/],
		[{ unit: "missing" }, /unknown unit/],
		[
			{ statistic: "share", unit: "people", aggregation: "none" },
			/share requires/,
		],
		[{ unit: "percent", aggregation: "none" }, /percent unit/],
		[{ statistic: "median" }, /sum is incompatible/],
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
			statistic: "by-dimension",
			aggregation: "none",
		}).statisticDimension,
		"pay-statistic",
	);
	assert.doesNotThrow(() =>
		validateMeasureSemantics({
			...base,
			slug: "progress-8",
			unit: "score",
			statistic: "mean",
			aggregation: "weighted_mean",
		}),
	);
	assert.throws(
		() =>
			validateMeasureSemantics({
				...base,
				slug: "another-mean",
				unit: "score",
				statistic: "mean",
				aggregation: "weighted_mean",
			}),
		/requires a weight/,
	);
});

test("every measure states its universe or why it has none", () => {
	assert.throws(
		() => validateMeasureSemantics({ ...base, slug: "unlisted-count" }),
		/no universe/,
	);
	assert.doesNotThrow(() =>
		validateMeasureSemantics({
			...base,
			slug: "collected-waste",
			unit: "tonnes",
			statistic: "total",
		}),
	);
	for (const slug of Object.keys(NOT_APPLICABLE_REASONS))
		assert.equal(measureSemantics({ ...base, slug }).universeId, 2, slug);
	assert.equal(
		measureSemantics({ ...base, slug: "band-d-council-tax" }).universeId,
		38,
	);
});

test("the legacy value kind is derived from the statistic, the unit kind and two exceptions", () => {
	assert.equal(legacyValueKind("population", "count", "count"), "count");
	assert.equal(legacyValueKind("gdp", "total", "currency"), "amount");
	assert.equal(
		legacyValueKind("house-price-mean", "mean", "currency"),
		"mean",
	);
	assert.equal(
		legacyValueKind("band-d-council-tax", "mean", "currency"),
		"amount",
	);
	assert.equal(
		legacyValueKind("social-care-quality-of-life", "mean", "index"),
		"index",
	);
	assert.equal(legacyValueKind("attainment-8", "mean", "index"), "mean");
	assert.equal(
		legacyValueKind("house-price-to-earnings-ratio", "ratio", "ratio"),
		"index",
	);
	assert.equal(
		legacyValueKind("gross-annual-pay", "by-dimension", "currency"),
		"amount",
	);
	assert.equal(
		legacyValueKind("gross-annual-pay-change", "by-dimension", "percent"),
		"rate",
	);
	assert.equal(legacyValueKind("majority", "difference", "count"), "count");
	assert.equal(
		legacyValueKind("party-vote-share-change", "difference", "other"),
		"rate",
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

test("every count names its denominator or says why it has none", () => {
	assert.throws(
		() => validateMeasureSemantics({ ...base, slug: "claimant-rate" }),
		/must name its denominator/,
	);
	for (const [slug, entry] of Object.entries(COUNT_DENOMINATORS)) {
		if (entry.kind === "none") assert.ok(entry.reason.length > 20, slug);
		else assert.ok(entry.denominator.measure in COUNT_DENOMINATORS, slug);
	}
	assert.equal(REBUILT_RATES.get("claimant-rate")?.numerator, "claimants");
	assert.deepEqual(
		REBUILT_RATES.get("claimant-rate")?.denominator.filter.age,
		{ from: 16, to: 64 },
	);
	assert.throws(
		() =>
			validateMeasureSemantics({
				...base,
				slug: "recorded-crimes-per-1000-residents",
				unit: "per 100,000",
				statistic: "rate",
				aggregation: "none",
			}),
		/needs a unit of that scale/,
	);
});
