import assert from "node:assert/strict";
import test from "node:test";
import type { MeasureSource } from "../src/dataCatalog";
import {
	resolveAggregationLocation,
	validateAggregationLocationSource,
} from "../src/aggregationLocation";

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

const source = (geography: string) =>
	({
		datasetId: "dataset.example",
		periods: ["2024"],
		sourceGeography: { type: geography, boundaryYear: 2024 },
		coverage: {
			kind: "source-reported",
			countries: [],
			recordCount: 1,
			note: "",
		},
	}) as MeasureSource;

test("resolves a named location and reports lookup failures", () => {
	assert.equal(resolveAggregationLocation({ locationId: null }), undefined);
	assert.equal(
		resolveAggregationLocation({ locationId: "example" })?.status,
		503,
	);
	assert.equal(
		resolveAggregationLocation({
			locationId: "missing",
			namedLocationLookup: new Map([[location.id, location]]),
		})?.status,
		404,
	);
	assert.deepEqual(
		resolveAggregationLocation({
			locationId: location.id,
			namedLocationLookup: new Map([[location.id, location]]),
		}),
		location,
	);
});

test("rejects a location whose geography differs from the source", () => {
	assert.equal(
		validateAggregationLocationSource({
			location,
			source: source("ward"),
		})?.status,
		422,
	);
	assert.equal(
		validateAggregationLocationSource({
			location,
			source: source("localAuthority"),
		}),
		undefined,
	);
	assert.equal(
		validateAggregationLocationSource({ source: source("ward") }),
		undefined,
	);
});
