import assert from "node:assert/strict";
import test from "node:test";
import { createGeographyResolver } from "../src/geographyResolver";
import { prepareAggregateTarget } from "../src/aggregatePreparation";

// These cases need no compiled areas, so the resolver is empty.
const geographyResolver = createGeographyResolver({});

const sourceGeography = { type: "localAuthority", boundaryYear: 2024 } as const;

const location = {
	id: "example",
	label: "Example",
	kind: "editorial-grouping" as const,
	definitionRevision: 1,
	memberGeography: "localAuthority",
	memberCodes: ["E1"],
	validity: { from: null, to: null },
	bbox: [0, 0, 1, 1] as [number, number, number, number],
};

test("prepares country and named-location aggregates", () => {
	const records = [
		{ areaCode: "E1", value: 10, status: "observed" as const },
	];
	const country = prepareAggregateTarget({
		geographyResolver,
		records,
		areaCode: "E92000001",
		compatibleReleases: [],
		sourceGeography,
	});
	assert.equal("status" in country, false);
	if ("status" in country) return;
	assert.equal(country.aggregate.value, 10);
	assert.equal(country.coverage?.status, "not-assessed");

	const named = prepareAggregateTarget({
		geographyResolver,
		records,
		location,
		areaCode: null,
		compatibleReleases: [],
		sourceGeography,
	});
	assert.equal("status" in named, false);
	if ("status" in named) return;
	assert.equal(named.aggregate.value, 10);
	assert.equal(named.locationCoverage, undefined);
});

test("refuses a country with no published members", () => {
	const result = prepareAggregateTarget({
		geographyResolver,
		records: [],
		areaCode: "E92000001",
		compatibleReleases: [],
		sourceGeography,
	});
	assert.equal("status" in result ? result.status : undefined, 422);
});
