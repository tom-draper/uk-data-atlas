import assert from "node:assert/strict";
import test from "node:test";
import { createGeographyResolver } from "../src/geographyResolver";
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
	const withLocation = createGeographyResolver({
		namedLocationInventory: {
			schemaVersion: 1,
			contentHash: "sha256:locations",
			source: {
				artifact: "data/datasets/gazetteer.core.json",
				gazetteerVersion: 1,
			},
			locations: [location],
		},
		namedLocationLookup: new Map([[location.id, location]]),
	});
	assert.equal(
		resolveAggregationLocation({
			locationId: null,
			geographyResolver: withLocation,
		}),
		undefined,
	);
	const unavailable = resolveAggregationLocation({
		locationId: "example",
		geographyResolver: createGeographyResolver({}),
	});
	assert.equal(
		unavailable && "status" in unavailable ? unavailable.status : undefined,
		503,
	);
	const missing = resolveAggregationLocation({
		locationId: "missing",
		geographyResolver: withLocation,
	});
	assert.equal(
		missing && "status" in missing ? missing.status : undefined,
		404,
	);
	assert.deepEqual(
		resolveAggregationLocation({
			locationId: location.id,
			geographyResolver: withLocation,
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
