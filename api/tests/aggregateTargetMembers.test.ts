import assert from "node:assert/strict";
import test from "node:test";
import type { AggregationTarget } from "../src/aggregationTarget";
import {
	aggregateTargetMembers,
	requireAggregateMembers,
} from "../src/aggregateTargetMembers";

const regional = {
	claim: "published-membership-lookup",
	sourceRelease: "2024-01",
	memberCodes: new Set(["E1"]),
	target: {
		id: "region/2024-01/R1",
		geography: "region",
		boundaryRelease: "2024-01",
		code: "R1",
	},
	crosswalk: {
		id: "crosswalk.example",
		method: "official-lookup",
		quality: "official",
	},
} as AggregationTarget;

test("selects country and regional members without changing records", () => {
	const records = [
		{ areaCode: "E1", value: 10, status: "observed" as const },
		{ areaCode: "W1", value: 20, status: "observed" as const },
	];
	const country = aggregateTargetMembers({
		records,
		areaCode: "E92000001",
	});
	assert.deepEqual(country.byCountry?.members, [records[0]]);
	assert.equal(country.aggregate?.value, 10);

	const region = aggregateTargetMembers({
		records,
		regional,
		areaCode: null,
	});
	assert.deepEqual(region.byRegion?.members, [records[0]]);
	assert.equal(region.aggregate?.value, 10);
});

test("refuses empty country and regional targets", () => {
	const emptyCountry = aggregateTargetMembers({
		records: [],
		areaCode: "E92000001",
	});
	const countryResult = requireAggregateMembers(emptyCountry);
	assert.equal(countryResult.status, 422);

	const emptyRegion = aggregateTargetMembers({
		records: [{ areaCode: "W1", value: 20, status: "observed" }],
		regional,
		areaCode: null,
	});
	const regionResult = requireAggregateMembers({ ...emptyRegion, regional });
	assert.equal(regionResult.status, 422);
});

test("refuses a request without a resolved target", () => {
	const result = requireAggregateMembers({});
	assert.equal(result.status, 400);
});
