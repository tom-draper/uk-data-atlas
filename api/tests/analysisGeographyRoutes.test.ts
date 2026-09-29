import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisGeographyInventory } from "../src/analysisGeographies";
import type { AnalysisGeographyValidationInventory } from "../src/analysisGeographyValidation";
import { createAreaLookup } from "../src/areaInventory";
import type { CrosswalkArtifact } from "../src/crosswalkInventory";
import { route as routeRequest } from "../src/routes";
import {
	containmentCrosswalk,
	crosswalkInventory,
	crosswalkLookup,
	dataCatalog,
	measureCompatibilityInventory,
	measureObservations,
	populationLocalAuthorityObservations,
	populationObservations,
	registry,
	testContext,
} from "./routeFixtures";

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
				id: inventory.supports[0]!.crosswalk!.id,
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
	assert.deepEqual("data" in response.body && response.body.data, {
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
	});
});

test("preflights an explicit source and retains not-comparable periods", () => {
	const base =
		"/v1/analysis:plan?measure=road-collisions&analysisGeography=localAuthority/2023-05-uk-bgc-v2&sourceGeography=lsoa&sourceBoundaryYear=2021";
	const available = route(`${base}&period=2025`);
	assert.equal(available.status, 200);
	const availableData =
		"data" in available.body ? available.body.data : undefined;
	assert.deepEqual(
		availableData && (availableData as { status: string }).status,
		"available",
	);
	assert.deepEqual(
		availableData && (availableData as { basis: string }).basis,
		"derived",
	);
	assert.match(
		String(availableData && (availableData as { result: string }).result),
		/\/v1\/data\/road-collisions\/convert/,
	);

	const unavailable = route(`${base}&period=2023`);
	assert.equal(unavailable.status, 200);
	assert.deepEqual(
		"data" in unavailable.body &&
			(unavailable.body.data as { status: string }).status,
		"not-comparable",
	);

	const ambiguous = route(
		"/v1/analysis:plan?measure=road-collisions&period=2025&analysisGeography=localAuthority/2023-05-uk-bgc-v2",
	);
	assert.equal(ambiguous.status, 400);
});

test("plans aggregation, coverage, expected size and a safer source-exact alternative", () => {
	const planAreaLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:plan-wards",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [
				{ code: "E05000001", name: "English ward" },
				{ code: "W05000001", name: "Welsh ward" },
			],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:plan-authorities",
			geography: "localAuthority",
			boundaryRelease: "2025-01-uk-lad",
			codeProperty: "LAD25CD",
			nameProperty: "LAD25NM",
			areas: [{ code: "E08000001", name: "Greater Manchester" }],
		},
	]);
	const analysisCrosswalk = {
		...containmentCrosswalk,
		id: "population-wards-to-authority",
		records: ["E05000001", "W05000001"].map((code) => ({
			source: { code, labels: [code] },
			targets: [{ code: "E08000001", labels: ["Greater Manchester"] }],
		})),
	};
	const planInventory: AnalysisGeographyInventory = {
		...inventory,
		supports: [
			{
				measureId: "population-estimate",
				analysisGeography: {
					geography: "localAuthority",
					boundaryRelease: "2025-01-uk-lad",
				},
				source: {
					datasetId: "population",
					geography: "ward",
					boundaryYear: 2023,
					periods: ["2022"],
				},
				crosswalk: {
					id: analysisCrosswalk.id,
					method: analysisCrosswalk.method,
					quality: analysisCrosswalk.quality,
				},
				note: "Exact regrouping.",
			},
		],
	};
	const response = routeRequest(
		"GET",
		"/v1/analysis:plan?measure=population-estimate&period=2022&analysisGeography=localAuthority/2025-01-uk-lad&sourceGeography=ward&sourceBoundaryYear=2023",
		testContext({
			analysisGeographyInventory: planInventory,
			areaLookup: planAreaLookup,
			crosswalkLookup: new Map<string, CrosswalkArtifact>([
				...crosswalkLookup,
				[analysisCrosswalk.id, analysisCrosswalk],
			]),
			crosswalkInventory: {
				...crosswalkInventory,
				crosswalks: [
					...crosswalkInventory.crosswalks,
					{
						id: analysisCrosswalk.id,
						from: analysisCrosswalk.from,
						to: analysisCrosswalk.to,
						method: analysisCrosswalk.method,
						quality: analysisCrosswalk.quality,
						weighting: analysisCrosswalk.weighting,
						recordCount: analysisCrosswalk.records.length,
						artifact: `crosswalks/${analysisCrosswalk.id}.json`,
						contentHash: analysisCrosswalk.contentHash,
					},
				],
			},
			dataCatalog,
			measureCompatibilityInventory,
			populationObservations,
			populationLocalAuthorityObservations,
			measureObservations,
			relationshipPathInventory: {
				schemaVersion: 1,
				contentHash: "sha256:paths",
				crosswalkInventoryHash: "sha256:crosswalk-inventory",
				paths: [
					{
						id: `${analysisCrosswalk.id}/forward/membership`,
						purpose: "membership",
						from: analysisCrosswalk.from,
						to: analysisCrosswalk.to,
						quality: "publisher-supplied",
						origin: "crosswalk",
						steps: [
							{
								crosswalkId: analysisCrosswalk.id,
								direction: "forward",
								method: analysisCrosswalk.method,
								purpose: "membership",
							},
						],
					},
				],
			},
		}),
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: Record<string, any> }).data;
	assert.deepEqual(data.aggregation, {
		kind: "extensive",
		operation: "sum",
		available: true,
	});
	assert.deepEqual(data.expectedSize, {
		targetAreaCount: 1,
		coveredAreaCount: 1,
		outputRecordCount: 1,
	});
	assert.equal(data.coverage.summary.coveredAreaCount, 1);
	assert.equal(data.conversionPlan.status, "available");
	assert.equal(
		data.conversionPlan.selectedPath.id,
		`${analysisCrosswalk.id}/forward/membership`,
	);
	assert.deepEqual(data.saferAlternatives, [
		{
			kind: "source-exact",
			href: "/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023",
			reason: "Keep the publisher's source partition when a conversion is not needed.",
		},
	]);
});

test("reports unsupported frames without manufacturing a conversion", () => {
	const response = route(
		"/v1/measures/road-collisions/conversion-support?analysisGeography=ward/2023-05-uk-bgc",
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body &&
			(response.body.data as { status: string }).status,
		"unsupported",
	);
});
