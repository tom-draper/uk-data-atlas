import assert from "node:assert/strict";
import { test } from "vitest";
import type { AnalysisGeographyInventory } from "@uk-data-atlas/relationships";
import {
	validateAnalysisGeographies,
	type AnalysisGeographyValidationInventory,
} from "@uk-data-atlas/catalogue/node";
import { createAreaLookup } from "@uk-data-atlas/areas";
import {
	measureSeriesSourceKey,
	registerSeriesObservations,
} from "@uk-data-atlas/measures";
import type { CrosswalkArtifact } from "@uk-data-atlas/relationships";
import { reportRequest as routeRequest } from "./evidenceFixtures";
import {
	containmentCrosswalk,
	crosswalkInventory,
	crosswalkLookup,
	dataCatalog,
	measureCompatibilityInventory,
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

test("does not expose conversion validation as a query route", () => {
	const response = routeRequest(
		"GET",
		"/v1/analysis-geography-validation",
		testContext({
			analysisGeographyInventory: inventory,
			analysisGeographyValidationInventory: validation,
		}),
	);
	assert.equal(response.status, 404);
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
		"/v1/analysis:plan?measure=road-collisions&to=localAuthority/2023-05-uk-bgc-v2&geography=lsoa&codeYear=2021";
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
	assert.ok("data" in unavailable.body);
	assert.equal("coverage" in (unavailable.body.data as object), false);
	assert.equal("expectedSize" in (unavailable.body.data as object), false);

	const ambiguous = route(
		"/v1/analysis:plan?measure=road-collisions&period=2025&to=localAuthority/2023-05-uk-bgc-v2",
	);
	assert.equal(ambiguous.status, 400);
});

test("preflights only the selected conversion and period, including with older receipts", () => {
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
			areas: [
				{ code: "E08000001", name: "Greater Manchester" },
				{ code: "E08000099", name: "Second authority" },
			],
		},
	]);
	const analysisCrosswalk = {
		...containmentCrosswalk,
		id: "population-wards-to-authority",
		records: [
			...containmentCrosswalk.records,
			{
				source: { code: "W05000001", labels: ["Welsh ward"] },
				targets: [{ code: "E08000099", labels: ["Second authority"] }],
			},
		],
	};
	const planInventory: AnalysisGeographyInventory = {
		...inventory,
		supports: [
			{
				measureId: "population",
				analysisGeography: {
					geography: "localAuthority",
					boundaryRelease: "2025-01-uk-lad",
				},
				source: {
					datasetId: "population",
					geography: "ward",
					boundaryYear: 2023,
					periods: ["2022", "2023"],
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
	const population = dataCatalog.measures.find(
		({ id }) => id === "population",
	)!;
	const source = { ...population.sources[0]!, periods: ["2022", "2023"] };
	const planCatalog = {
		...dataCatalog,
		measures: dataCatalog.measures.map((measure) =>
			measure === population
				? {
						...measure,
						sources: [source, ...population.sources.slice(1)],
					}
				: measure,
		),
	};
	const records = populationObservations.periods[0]!.records;
	const observations = {
		...populationObservations,
		periods: [
			{ period: "2022", records: records.slice(0, 1) },
			{ period: "2023", records },
		],
	};
	const observationArtifacts = [observations];
	registerSeriesObservations(
		observationArtifacts,
		new Map([
			[measureSeriesSourceKey(population.series!, source), observations],
		]),
	);
	const crosswalks = new Map<string, CrosswalkArtifact>([
		...crosswalkLookup,
		[analysisCrosswalk.id, analysisCrosswalk],
	]);
	const compiled = validateAnalysisGeographies(
		planInventory,
		planCatalog,
		crosswalks,
		new Map([["population-observations", observations]]),
	);
	const receipt = compiled.supports[0]!;
	const legacy = {
		...compiled,
		supports: [
			{
				...receipt,
				periods: receipt.periods.map(
					({ targetCodes: _targetCodes, ...period }) => period,
				),
			},
		],
	};
	const context = testContext({
		analysisGeographyInventory: planInventory,
		areaLookup: planAreaLookup,
		crosswalkLookup: crosswalks,
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
		dataCatalog: planCatalog,
		measureCompatibilityInventory,
		measureObservations: observationArtifacts,
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
	});
	const plan = (
		period: string,
		context: Parameters<typeof routeRequest>[2],
	) => {
		const response = routeRequest(
			"GET",
			`/v1/analysis:plan?measure=population&period=${period}&to=localAuthority/2025-01-uk-lad&geography=ward&codeYear=2023`,
			context,
		);
		assert.equal(response.status, 200);
		const { data } = response.body as { data: Record<string, any> };
		return data;
	};
	const compiledContext = {
		...context,
		measureObservations: undefined,
		analysisGeographyValidationInventory: {
			...compiled,
			supports: [
				{
					...receipt,
					crosswalk: { ...receipt.crosswalk!, id: "other-crosswalk" },
					periods: [],
				},
				receipt,
			],
		},
	};
	const data = plan("2022", compiledContext);
	assert.deepEqual(
		data,
		plan("2022", {
			...context,
			analysisGeographyValidationInventory: legacy,
		}),
	);
	const later = plan("2023", compiledContext);
	assert.deepEqual(later.expectedSize, {
		targetAreaCount: 2,
		coveredAreaCount: 2,
		outputRecordCount: 2,
	});
	assert.equal(later.coverage.countries[0].status, "converted");
	assert.equal(later.coverage.countries[0].conversion.source.period, "2023");
	for (const planned of [data, later]) {
		const result = routeRequest("GET", planned.result, context);
		assert.equal(result.status, 200);
		const { records } = (result.body as { data: { records: unknown[] } })
			.data;
		assert.equal(records.length, planned.expectedSize.outputRecordCount);
	}
	assert.deepEqual(data.aggregation, {
		kind: "extensive",
		operation: "sum",
		available: true,
	});
	assert.deepEqual(data.expectedSize, {
		targetAreaCount: 2,
		coveredAreaCount: 1,
		outputRecordCount: 1,
	});
	assert.equal(data.coverage.summary.coveredAreaCount, 1);
	assert.equal(data.coverage.countries[0].status, "partial");
	assert.equal(
		data.coverage.countries[0].conversion.crosswalk.id,
		analysisCrosswalk.id,
	);
	assert.equal(data.conversionPlan.status, "available");
	assert.equal(
		data.conversionPlan.selectedPath.id,
		`${analysisCrosswalk.id}/forward/membership`,
	);
	assert.deepEqual(data.saferAlternatives, [
		{
			kind: "source-exact",
			href: "/v1/data/population?period=2022&geography=ward&codeYear=2023&datasetId=population",
			reason: "Keep the publisher's source partition when a conversion is not needed.",
		},
		{
			kind: "coverage-plan",
			href: "/v1/documents/measure-population.json",
			reason: "Inspect the country-by-country gap before using a partial analysis frame.",
		},
	]);
});

test("reports unsupported frames without manufacturing a conversion", () => {
	const response = route(
		"/v1/measures/road-collisions/conversion-support?to=ward/2023-05-uk-bgc",
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body &&
			(response.body.data as { status: string }).status,
		"unsupported",
	);
});
