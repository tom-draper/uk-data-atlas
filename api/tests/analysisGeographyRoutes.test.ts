import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisGeographyInventory } from "../src/analysisGeographies";
import type {
	AnalysisGeographyValidationInventory,
} from "../src/analysisGeographyValidation";
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
				periods: ["2024", "2025"],
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

const validation: AnalysisGeographyValidationInventory = {
	schemaVersion: 1,
	contentHash: "sha256:analysis-geography-validation",
	analysisGeographyInventoryHash: inventory.contentHash,
	dataCatalogHash: inventory.dataCatalogHash,
	crosswalkInventoryHash: inventory.crosswalkInventoryHash,
	supports: [
		{
			measureId: inventory.supports[0]!.measureId,
			analysisGeography: inventory.supports[0]!.analysisGeography,
			source: inventory.supports[0]!.source,
			crosswalk: {
				id: inventory.supports[0]!.crosswalk.id,
				contentHash: "sha256:crosswalk",
			},
			observations: {
				artifact: "road-collisions-lsoa-2021-observations",
				contentHash: "sha256:observations",
			},
			periods: [
				{
					period: "2025",
					method: "exact",
					inputRecordCount: 2,
					outputRecordCount: 1,
					inputTotal: 3,
					outputTotal: 3,
				},
			],
		},
	],
};

const route = (url: string) =>
	routeRequest(
		"GET",
		url,
		testContext({ analysisGeographyInventory: inventory }),
	);

test("serves the release-pinned validation receipt for reviewed conversions", () => {
	const response = routeRequest(
		"GET",
		"/v1/analysis-geography-validation",
		testContext({
			analysisGeographyInventory: inventory,
			analysisGeographyValidationInventory: validation,
		}),
	);
	assert.equal(response.status, 200);
	assert.deepEqual("data" in response.body && response.body.data, validation);
});

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
	const available = route(`${base}&period=2025`);
	assert.equal(available.status, 200);
	const availableData = "data" in available.body ? available.body.data : undefined;
	assert.deepEqual(availableData && (availableData as { status: string }).status, "available");
	assert.deepEqual(availableData && (availableData as { basis: string }).basis, "derived");
	assert.match(
		String(availableData && (availableData as { result: string }).result),
		/\/v1\/data\/road-collisions\/convert/,
	);

	const unavailable = route(`${base}&period=2023`);
	assert.equal(unavailable.status, 200);
	assert.deepEqual(
		"data" in unavailable.body && (unavailable.body.data as { status: string }).status,
		"not-comparable",
	);

	const ambiguous = route(
		"/v1/analysis:plan?measure=road-collisions&period=2025&analysisGeography=localAuthority/2023-05-uk-bgc-v2",
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
