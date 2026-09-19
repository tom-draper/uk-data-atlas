import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisGeographyInventory } from "../src/analysisGeographies";
import { route as routeRequest } from "../src/routes";
import { registry, testContext } from "./routeFixtures";

const inventory: AnalysisGeographyInventory = {
	schemaVersion: 1,
	contentHash: "sha256:analysis-geographies",
	dataCatalogHash: "sha256:data-catalog",
	crosswalkInventoryHash: "sha256:crosswalk-inventory",
	supports: [
		{
			measureId: "road-collisions",
			analysisGeography: {
				geography: "localAuthority",
				boundaryRelease: "2023-05-uk-bgc-v2",
			},
			source: {
				datasetId: "road-collisions",
				geography: "lsoa",
				boundaryYear: 2021,
				periods: ["2025-H1"],
			},
			crosswalk: {
				id: "lsoa-2021-to-local-authority-2023",
				method: "clean-containment",
				quality: "publisher-supplied",
			},
			note: "Exact regrouping.",
		},
	],
};

const route = (url: string) =>
	routeRequest(
		"GET",
		url,
		testContext({ analysisGeographyInventory: inventory }),
	);

test("lists only reviewed analysis conversions", () => {
	const response = route("/v1/analysis-geographies?measure=road-collisions");
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		{
			analysisGeographies: [
				{
					geography: "localAuthority",
					boundaryRelease: "2023-05-uk-bgc-v2",
					measureId: "road-collisions",
					source: inventory.supports[0]!.source,
					basis: "derived",
					conversion: inventory.supports[0]!.crosswalk,
					note: "Exact regrouping.",
				},
			],
		},
	);
});

test("preflights an explicit source and retains not-comparable periods", () => {
	const base =
		"/v1/analysis:plan?measure=road-collisions&analysisGeography=localAuthority/2023-05-uk-bgc-v2&sourceGeography=lsoa&sourceBoundaryYear=2021";
	const available = route(`${base}&period=2025-H1`);
	assert.equal(available.status, 200);
	const availableData = "data" in available.body ? available.body.data : undefined;
	assert.deepEqual(availableData && (availableData as { status: string }).status, "available");
	assert.deepEqual(availableData && (availableData as { basis: string }).basis, "derived");
	assert.match(
		String(availableData && (availableData as { result: string }).result),
		/\/v1\/data\/road-collisions\/convert/,
	);

	const unavailable = route(`${base}&period=2024`);
	assert.equal(unavailable.status, 200);
	assert.deepEqual(
		"data" in unavailable.body && (unavailable.body.data as { status: string }).status,
		"not-comparable",
	);

	const ambiguous = route(
		"/v1/analysis:plan?measure=road-collisions&period=2025-H1&analysisGeography=localAuthority/2023-05-uk-bgc-v2",
	);
	assert.equal(ambiguous.status, 400);
});

test("reports unsupported frames without manufacturing a conversion", () => {
	const response = route(
		"/v1/measures/road-collisions/conversion-support?analysisGeography=ward/2023-05-uk-bgc",
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && (response.body.data as { status: string }).status,
		"unsupported",
	);
});
