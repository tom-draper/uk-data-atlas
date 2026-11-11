import assert from "node:assert/strict";
import { test } from "vitest";
import type {
	ConversionBasis,
	Step,
} from "../../src/conversion/crosswalkSteps.ts";
import {
	basisOrder,
	chooseBasis,
	subjectBasis,
} from "../../src/conversion/weightBasis.ts";

const measure = (slug: string, unit = "count") => ({ slug, unit });

const stepMissing = (count: number): Step =>
	({
		blocked: new Map(
			Array.from({ length: count }, (_, i) => [
				i,
				{ reason: "no-weight" as const, targets: [] },
			]),
		),
	}) as unknown as Step;

test("a measure's subject picks its basis", () => {
	assert.equal(subjectBasis(measure("usual-residents")), "population");
	assert.equal(subjectBasis(measure("fuel-poor-households")), "households");
	assert.equal(subjectBasis(measure("electricity-meters")), "dwellings");
	assert.equal(subjectBasis(measure("dwelling-stock")), "dwellings");
	assert.equal(subjectBasis(measure("land-area", "hectares")), "population");
});

test("the order starts with the subject and lists each basis once", () => {
	assert.deepEqual(basisOrder(measure("households")), [
		"households",
		"population",
		"dwellings",
		"postcodes",
	]);
	assert.deepEqual(basisOrder(measure("population")), [
		"population",
		"households",
		"dwellings",
		"postcodes",
	]);
});

test("the first basis with every weight held is chosen", () => {
	const missing: Record<ConversionBasis, number> = {
		households: 4,
		population: 0,
		dwellings: 0,
		postcodes: 0,
	};
	assert.equal(
		chooseBasis(measure("households"), (basis) => [
			stepMissing(missing[basis]),
		]),
		"population",
	);
});

test("with no complete basis the one missing the fewest is chosen", () => {
	const missing: Record<ConversionBasis, number> = {
		households: 4,
		population: 3,
		dwellings: 1,
		postcodes: 1,
	};
	assert.equal(
		chooseBasis(measure("households"), (basis) => [
			stepMissing(missing[basis]),
		]),
		"dwellings",
	);
});

test("a route of exact steps keeps the subject's basis", () => {
	assert.equal(
		chooseBasis(measure("households"), () => [stepMissing(0)]),
		"households",
	);
});
