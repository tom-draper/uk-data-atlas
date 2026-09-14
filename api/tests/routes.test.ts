import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import {
	AreaGeometryCache,
	type GeometrySourceLookup,
} from "../src/areaGeometry";
import {
	route as routeRequest,
	type CrosswalkLookup,
	type RouteContext,
} from "../src/routes";
import type { AtlasRelease } from "../src/atlasRelease";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";
import type { GeographyInventory } from "../src/geographyInventory";
import type { RelationshipCandidateInventory } from "../src/relationshipCandidates";
import {
	createNamedLocationLookup,
	type NamedLocationInventory,
} from "../src/namedLocations";
import type { ValidationReport } from "../src/validationReport";
import type {
	CategoricalObservation,
	MeasureObservationArtifact,
	MeasureSource,
	PopulationLocalAuthorityObservationArtifact,
	DataCatalog,
	PopulationObservationArtifact,
} from "../src/dataCatalog";
import type { MeasureCompatibilityInventory } from "../src/measureCompatibility";

// Most tests exercise one narrow dependency combination. This fixture adapter
// keeps those cases concise while ensuring the production router only accepts
// its named RouteContext.
const route = (
	method: string | undefined,
	url: string | undefined,
	boundaryRegistry: BoundaryRegistry,
	geographyInventory?: RouteContext["geographyInventory"],
	areaLookup?: RouteContext["areaLookup"],
	crosswalkInventory?: RouteContext["crosswalkInventory"],
	crosswalkLookup?: RouteContext["crosswalkLookup"],
	atlasRelease?: RouteContext["atlasRelease"],
	areaSearchIndex?: RouteContext["areaSearchIndex"],
	areaRelationshipIndex?: RouteContext["areaRelationshipIndex"],
	areaGeometryCache?: RouteContext["areaGeometryCache"],
	relationshipCandidateInventory?: RouteContext["relationshipCandidateInventory"],
	validationReport?: RouteContext["validationReport"],
	namedLocationInventory?: RouteContext["namedLocationInventory"],
	namedLocationLookup?: RouteContext["namedLocationLookup"],
	dataCatalog?: RouteContext["dataCatalog"],
	populationObservations?: RouteContext["populationObservations"],
	populationLocalAuthorityObservations?: RouteContext["populationLocalAuthorityObservations"],
	measureCompatibilityInventory?: RouteContext["measureCompatibilityInventory"],
	measureObservations?: RouteContext["measureObservations"],
	exportManifest?: RouteContext["exportManifest"],
) =>
	routeRequest(method, url, {
		boundaryRegistry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		areaSearchIndex,
		areaRelationshipIndex,
		areaGeometryCache,
		relationshipCandidateInventory,
		validationReport,
		namedLocationInventory,
		namedLocationLookup,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureCompatibilityInventory,
		measureObservations,
		exportManifest,
	});

const registry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [
		{
			id: "2025-01-en-ward",
			geography: "ward",
			title: "Ward boundaries",
			coverage: { countries: ["GB-ENG"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/source",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: "sha256:metadata",
		},
	],
};

const geographyInventory: GeographyInventory = {
	schemaVersion: 1,
	contentHash: "sha256:geography",
	boundaryRegistryHash: "sha256:registry",
	releases: [],
	geographies: [],
};

const areaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:areas",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		codeProperty: "WD25CD",
		nameProperty: "WD25NM",
		areas: [
			{
				code: "E05000001",
				name: "Example ward",
				aliases: ["Enghraifft ward"],
			},
			{ code: "E05000002", name: "Other ward" },
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:local-authority-areas",
		geography: "localAuthority",
		boundaryRelease: "2025-01-uk-lad",
		codeProperty: "LAD25CD",
		nameProperty: "LAD25NM",
		areas: [
			{ code: "E08000001", name: "Greater Manchester", aliases: ["GM"] },
		],
	},
]);

const compatibleWardAreaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:compatible-wards",
		geography: "ward",
		boundaryRelease: "2023-05-uk-bgc",
		codeProperty: "WD23CD",
		nameProperty: "WD23NM",
		areas: [
			{ code: "E05000001", name: "Compatible ward" },
			{ code: "W05000001", name: "Ward compatible" },
		],
	},
]);

// Named locations are curated from the gazetteer and carry codes from several
// vintages, so this lookup spans three releases: one older than the requested
// release, the requested one, and one newer.
const namedLocationAreaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:legacy-local-authority-areas",
		geography: "localAuthority",
		boundaryRelease: "2019-12-uk-lad",
		codeProperty: "LAD19CD",
		nameProperty: "LAD19NM",
		areas: [{ code: "E08000999", name: "Legacy authority" }],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:local-authority-areas",
		geography: "localAuthority",
		boundaryRelease: "2025-01-uk-lad",
		codeProperty: "LAD25CD",
		nameProperty: "LAD25NM",
		areas: [
			{ code: "E08000001", name: "Greater Manchester", aliases: ["GM"] },
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:recoded-local-authority-areas",
		geography: "localAuthority",
		boundaryRelease: "2026-05-uk-lad",
		codeProperty: "LAD26CD",
		nameProperty: "LAD26NM",
		areas: [{ code: "E08000998", name: "Recoded authority" }],
	},
]);

const crosswalkArtifact: CrosswalkArtifact = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalk-artifact",
	id: "constituency-2010-to-2024",
	method: "official-lookup",
	quality: "publisher-supplied",
	weighting: { status: "not-provided" },
	from: { geography: "constituency", boundaryRelease: "2010" },
	to: { geography: "constituency", boundaryRelease: "2024-07-uk-bgc" },
	provenance: { input: "lookup.geojson", inputHash: "sha256:input" },
	validation: {
		sourceNameConflicts: [],
		endpoints: {
			from: {
				status: "not-available",
				reason: "No compiled area release is available for constituency/2010.",
			},
			to: {
				status: "verified",
				availableAreaCount: 650,
				referencedCodeCount: 650,
			},
		},
	},
	records: [
		{
			source: { code: "E14000001", labels: ["Old seat"] },
			targets: [{ code: "E14001001", labels: ["New seat A"] }],
		},
	],
};

const crosswalkInventory: CrosswalkInventory = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalk-inventory",
	crosswalks: [
		{
			id: crosswalkArtifact.id,
			from: crosswalkArtifact.from,
			to: crosswalkArtifact.to,
			method: crosswalkArtifact.method,
			quality: crosswalkArtifact.quality,
			weighting: crosswalkArtifact.weighting,
			recordCount: crosswalkArtifact.records.length,
			artifact: `crosswalks/${crosswalkArtifact.id}.json`,
			contentHash: crosswalkArtifact.contentHash,
		},
	],
};

const containmentCrosswalk: CrosswalkArtifact = {
	...crosswalkArtifact,
	contentHash: "sha256:containment-artifact",
	id: "ward-to-local-authority-2025",
	method: "clean-containment",
	weighting: { status: "not-applicable" },
	from: { geography: "ward", boundaryRelease: "2025-01-en-ward" },
	to: { geography: "localAuthority", boundaryRelease: "2025-01-uk-lad" },
	records: [
		{
			source: { code: "E05000001", labels: ["Example ward"] },
			targets: [{ code: "E08000001", labels: ["Greater Manchester"] }],
		},
	],
};

const crosswalkLookup: CrosswalkLookup = new Map([
	[crosswalkArtifact.id, crosswalkArtifact],
	[containmentCrosswalk.id, containmentCrosswalk],
]);

const namedLocationInventory: NamedLocationInventory = {
	schemaVersion: 1,
	contentHash: "sha256:named-locations",
	source: {
		artifact: "data/precompiled/gazetteer.core.json",
		gazetteerVersion: 1,
	},
	locations: [
		{
			id: "greater-manchester",
			label: "Greater Manchester",
			kind: "editorial-grouping",
			memberCodes: ["E08000000", "E08000001", "E08000998", "E08000999"],
			bbox: [-2.5, 53.3, -2, 53.7],
		},
	],
};

const namedLocationLookup = createNamedLocationLookup(namedLocationInventory);

const aggregationNamedLocationLookup = createNamedLocationLookup({
	schemaVersion: 1,
	contentHash: "sha256:aggregation-locations",
	source: {
		artifact: "data/precompiled/gazetteer.core.json",
		gazetteerVersion: 1,
	},
	locations: [
		{
			id: "test-wards",
			label: "Test wards",
			kind: "editorial-grouping",
			memberCodes: ["E05000001", "W05000001"],
			bbox: [-2.5, 53.3, -2, 53.7],
		},
		{
			id: "incomplete-test-wards",
			label: "Incomplete test wards",
			kind: "editorial-grouping",
			memberCodes: ["E05000001", "E05000999"],
			bbox: [-2.5, 53.3, -2, 53.7],
		},
	],
});

const dataCatalog: DataCatalog = {
	schemaVersion: 1,
	contentHash: "sha256:data-catalog",
	source: {
		artifact: "data/precompiled/dataset-manifest.json",
		manifestVersion: 1,
	},
	datasets: [
		{
			id: "population",
			label: "Population",
			publisher: "ONS",
			sourceUrl: "https://example.com/population",
			temporalCoverage: "2022",
			licence: { name: "Open Government Licence" },
			inputs: [],
			summary: {
				datasetCount: 1,
				dataRecordCount: 2,
				boundaryYears: [2023],
			},
			compiled: { bytes: 1, sha256: "compiled" },
		},
	],
	measures: [
		{
			id: "population-estimate",
			label: "Population estimate",
			valueKind: "count",
			unit: "people",
			aggregation: {
				kind: "extensive",
				operation: "sum",
				available: true,
			},
			sources: [
				{
					datasetId: "population",
					periods: ["2022"],
					sourceGeography: { type: "ward", boundaryYear: 2023 },
					coverage: {
						kind: "partial",
						countries: ["GB-ENG", "GB-WLS"],
						recordCount: 2,
						note: "England and Wales only.",
					},
				},
				{
					datasetId: "population-uk",
					periods: ["2022", "2023", "2024"],
					sourceGeography: {
						type: "localAuthority",
						boundaryYear: 2023,
					},
					coverage: {
						kind: "source-reported",
						countries: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"],
						recordCount: 4,
						note: "All UK nations.",
					},
				},
			],
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: true,
			},
			links: { data: "/v1/data/population-estimate" },
		},
		{
			id: "ghg-emissions",
			label: "Greenhouse gas emissions",
			valueKind: "quantity",
			unit: "kt CO2e",
			aggregation: {
				kind: "extensive",
				operation: "sum",
				available: true,
			},
			sources: [
				{
					datasetId: "ghg-emissions",
					periods: ["2024"],
					sourceGeography: {
						type: "localAuthority",
						boundaryYear: 2025,
					},
					coverage: {
						kind: "source-reported",
						countries: ["GB-ENG"],
						recordCount: 1,
						note: "All UK nations.",
					},
				},
			],
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: true,
			},
			links: { data: "/v1/data/ghg-emissions" },
		},
		{
			id: "mobile-5g-coverage",
			label: "5G mobile coverage",
			valueKind: "ratio",
			unit: "% of premises",
			aggregation: {
				kind: "intensive",
				operation: "weighted-mean",
				weight: {
					description: "The authority's premises count.",
					datasetField: "premisesCount",
				},
				available: false,
			},
			sources: [
				{
					datasetId: "mobile-coverage",
					periods: ["2025"],
					sourceGeography: {
						type: "localAuthority",
						boundaryYear: 2024,
					},
					coverage: {
						kind: "source-reported",
						countries: ["GB-ENG"],
						recordCount: 1,
						note: "All UK nations.",
					},
				},
			],
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: false,
			},
			links: { data: "/v1/data/mobile-5g-coverage" },
		},
		{
			id: "travel-to-work-car",
			label: "Travel to work by car or van",
			valueKind: "count",
			unit: "people in employment",
			aggregation: {
				kind: "extensive",
				operation: "sum",
				available: true,
			},
			sources: [
				{
					datasetId: "travel-to-work",
					periods: ["2021"],
					sourceGeography: {
						type: "localAuthority",
						boundaryYear: 2025,
					},
					coverage: {
						kind: "partial",
						countries: ["GB-ENG", "GB-WLS"],
						recordCount: 1,
						note: "England and Wales only.",
					},
				},
			],
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: true,
			},
			links: { data: "/v1/data/travel-to-work-car" },
			notes: [
				"Usual residents aged 16 and over in employment in the week before the census.",
				"The census reports on 2021 boundaries. The four authorities created in April 2023 are compiled by summing their predecessors, which is exact for a count.",
			],
		},
		{
			id: "house-price-median",
			label: "Median house price paid",
			valueKind: "currency",
			unit: "GBP",
			aggregation: {
				kind: "non-aggregatable",
				statistic: "median",
				note: "A median of ward medians is not the median of the underlying sales.",
				available: false,
			},
			sources: [
				{
					datasetId: "house-price",
					periods: ["2022"],
					sourceGeography: { type: "ward", boundaryYear: 2020 },
					coverage: {
						kind: "partial",
						countries: ["GB-ENG"],
						recordCount: 1,
						note: "England and Wales only.",
					},
				},
			],
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: false,
			},
			links: { data: "/v1/data/house-price-median" },
		},
		{
			id: "small-area-fixture",
			label: "Small area fixture",
			valueKind: "count",
			unit: "people",
			aggregation: {
				kind: "extensive",
				operation: "sum",
				available: true,
			},
			sources: [
				{
					datasetId: "small-area",
					periods: ["2019"],
					sourceGeography: { type: "lsoa", boundaryYear: 2011 },
					coverage: {
						kind: "partial",
						countries: ["GB-ENG"],
						recordCount: 2,
						note: "England only.",
					},
				},
			],
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: false,
			},
			links: { data: "/v1/data/small-area-fixture" },
		},
	],
};

const measureObservations: MeasureObservationArtifact[] = [
	{
		schemaVersion: 1,
		contentHash: "sha256:small-area-observations",
		measureId: "small-area-fixture",
		sourceGeography: { type: "lsoa", boundaryYear: 2011 },
		periods: [
			{
				period: "2019",
				records: [
					{ areaCode: "E01000001", value: 1500, status: "observed" },
					{ areaCode: "E01000002", value: 1600, status: "observed" },
				],
			},
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:house-price-observations",
		measureId: "house-price-median",
		sourceGeography: { type: "ward", boundaryYear: 2020 },
		periods: [
			{
				period: "2022",
				records: [
					{
						areaCode: "E05000001",
						value: 250000,
						status: "observed",
					},
				],
			},
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:emissions-observations",
		measureId: "ghg-emissions",
		sourceGeography: { type: "localAuthority", boundaryYear: 2025 },
		periods: [
			{
				period: "2024",
				records: [
					{ areaCode: "E06000001", value: 400, status: "observed" },
				],
			},
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:mobile-5g-observations",
		measureId: "mobile-5g-coverage",
		sourceGeography: { type: "localAuthority", boundaryYear: 2024 },
		periods: [
			{
				period: "2025",
				records: [
					{ areaCode: "E06000001", value: 40.5, status: "observed" },
				],
			},
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:travel-car-observations",
		measureId: "travel-to-work-car",
		sourceGeography: { type: "localAuthority", boundaryYear: 2025 },
		periods: [
			{
				period: "2021",
				records: [
					{ areaCode: "E06000001", value: 24724, status: "observed" },
				],
			},
		],
	},
];

const populationObservations: PopulationObservationArtifact = {
	schemaVersion: 1,
	contentHash: "sha256:population-observations",
	measureId: "population-estimate",
	period: "2022",
	sourceGeography: { type: "ward", boundaryYear: 2023 },
	records: [
		{ areaCode: "E05000001", value: 100, status: "observed" },
		{ areaCode: "W05000001", value: 200, status: "observed" },
	],
};

const populationLocalAuthorityObservations: PopulationLocalAuthorityObservationArtifact =
	{
		schemaVersion: 1,
		contentHash: "sha256:population-local-authority-observations",
		measureId: "population-estimate",
		sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
		periods: [
			{
				period: "2022",
				records: [
					{ areaCode: "E06000001", value: 280, status: "observed" },
					{ areaCode: "N09000001", value: 380, status: "observed" },
				],
			},
			{
				period: "2023",
				records: [
					{ areaCode: "E06000001", value: 290, status: "observed" },
					{ areaCode: "N09000001", value: 390, status: "observed" },
				],
			},
			{
				period: "2024",
				records: [
					{ areaCode: "E06000001", value: 300, status: "observed" },
					{ areaCode: "N09000001", value: 400, status: "observed" },
				],
			},
		],
	};

const measureCompatibilityInventory: MeasureCompatibilityInventory = {
	schemaVersion: 1,
	contentHash: "sha256:measure-compatibility",
	inputs: {
		dataCatalog: "sha256:data-catalog",
		boundaryRegistry: "sha256:registry",
		populationObservations: "sha256:population-observations",
		populationLocalAuthorityObservations:
			"sha256:population-local-authority-observations",
		areaArtifacts: { "ward/2023-05-uk-bgc": "sha256:areas" },
	},
	measures: [
		{
			measureId: "population-estimate",
			sources: [
				{
					datasetId: "population",
					sourceGeography: { type: "ward", boundaryYear: 2023 },
					periods: ["2022"],
					candidates: [
						{
							boundaryRelease: "2023-05-uk-bgc",
							title: "Wards, May 2023",
							coverageCountries: ["GB-ENG", "GB-WLS"],
							status: "code-set-compatible",
							sourceCodeCount: 2,
							candidateCodeCount: 3,
							matchingCodeCount: 2,
							matchedSourceShare: 1,
							unmatchedSourceCodeCount: 0,
							unmatchedSourceCodeSample: [],
							candidateOnlyCodeCount: 1,
							candidateOnlyCodeSample: ["S13000001"],
						},
					],
					note: "Compatibility is based only on area-code membership.",
				},
			],
		},
	],
};

const routeWithNamedLocations = (url: string) =>
	route(
		"GET",
		url,
		registry,
		geographyInventory,
		namedLocationAreaLookup,
		crosswalkInventory,
		crosswalkLookup,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		namedLocationInventory,
		namedLocationLookup,
	);

const routeWithData = (url: string) =>
	routeWithCatalog(url, dataCatalog, measureObservations);

test("reports a measure quality matrix before querying its observations", () => {
	const response = routeWithData("/v1/measures/small-area-fixture/quality");
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual(
		(data as { measure: { id: string } }).measure.id,
		"small-area-fixture",
	);
	assert.deepEqual(
		(
			data as {
				sources: Array<{
					periods: Array<{
						period: string;
						recordCount: number;
						statusCounts: Record<string, number>;
					}>;
				}>;
			}
		).sources[0]?.periods,
		[
			{
				period: "2019",
				artifact: "small-area-fixture-observations",
				contentHash: "sha256:small-area-observations",
				recordCount: 2,
				statusCounts: { observed: 2 },
			},
		],
	);
});

test("reports an area's exact-release capability and availability matrix", () => {
	const response = routeRequest(
		"GET",
		"/v1/areas/ward/2023-05-uk-bgc/E05000001/capabilities",
		{
			boundaryRegistry: registry,
			areaLookup: compatibleWardAreaLookup,
			crosswalkLookup,
			namedLocationInventory,
			dataCatalog,
			populationObservations,
			populationLocalAuthorityObservations,
			measureObservations,
			measureCompatibilityInventory,
		},
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && typeof data === "object" && "capabilities" in data);
	const capabilities = (data as { capabilities: Record<string, unknown> })
		.capabilities;
	assert.deepEqual(capabilities.geometry, {
		status: "not-published",
		href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/geometry",
	});
	assert.deepEqual(capabilities.relationships, {
		status: "available",
		href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/relationships",
		count: 0,
		byRelation: {},
		parents: {
			count: 0,
			href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/parents",
		},
		children: {
			count: 0,
			href: "/v1/areas/ward/2023-05-uk-bgc/E05000001/children",
		},
		crosswalks: [],
	});
	assert.equal(
		(capabilities.namedLocations as { status: string }).status,
		"available",
	);
	const measureData = capabilities.data as {
		status: string;
		measures: Array<{
			id: string;
			sources: Array<{
				periods: Array<{ availability: string; status?: string }>;
			}>;
		}>;
	};
	assert.equal(measureData.status, "available");
	assert.deepEqual(measureData.measures, [
		{
			id: "population-estimate",
			valueKind: "count",
			unit: "people",
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: true,
			},
			href: "/v1/measures/population-estimate",
			sources: [
				{
					dataset: {
						id: "population",
						href: "/v1/datasets/population",
					},
					sourceGeography: { type: "ward", boundaryYear: 2023 },
					codeSetCompatibility: {
						boundaryRelease: "2023-05-uk-bgc",
						title: "Wards, May 2023",
						coverageCountries: ["GB-ENG", "GB-WLS"],
						status: "code-set-compatible",
						sourceAreaCount: 2,
						boundaryAreaCount: 3,
						matchingSourceAreaCount: 2,
						matchingSourceAreaShare: 1,
						unmatchedSourceAreaCount: 0,
						candidateOnlyAreaCount: 1,
						eligibleForCodeJoin: true,
					},
					periods: [
						{
							period: "2022",
							artifact: "population-observations",
							contentHash: "sha256:population-observations",
							availability: "present",
							status: "observed",
						},
					],
				},
			],
		},
	]);
});

const routeWithCatalog = (
	url: string,
	catalog: DataCatalog,
	observations: RouteContext["measureObservations"],
	overrides: Pick<
		RouteContext,
		"crosswalkLookup" | "measureCompatibilityInventory" | "exportManifest"
	> = {},
) =>
	route(
		"GET",
		url,
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		overrides.crosswalkLookup ?? crosswalkLookup,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		catalog,
		populationObservations,
		populationLocalAuthorityObservations,
		overrides.measureCompatibilityInventory ??
			measureCompatibilityInventory,
		observations,
		overrides.exportManifest,
	);

const populationProvenance = (
	datasetId: "population" | "population-uk",
	geography: "ward" | "localAuthority",
	period: string,
	contentHash: string,
	geometry?: {
		boundaryRelease: string;
		compatibility: "exact-code-set" | "code-set-compatible";
		note: string;
	},
) => ({
	atlasRelease: { id: registry.contentHash, href: "/v1/atlas-release" },
	measure: {
		id: "population-estimate",
		href: "/v1/measures/population-estimate",
	},
	source: {
		dataset: { id: datasetId, href: `/v1/datasets/${datasetId}` },
		observations: {
			artifact:
				geography === "ward"
					? "population-observations"
					: "population-local-authority-observations",
			contentHash,
			period,
		},
	},
	geography: {
		source: { type: geography, boundaryYear: 2023 },
		match:
			geometry === undefined
				? {
						status: "no-boundary-release-selected",
						note: "The published observations declare a geography type and code vintage, but not a boundary release.",
					}
				: {
						status: "caller-selected-code-join",
						boundaryRelease: geometry.boundaryRelease,
						compatibility: geometry.compatibility,
						href: "/v1/measures/population-estimate/compatibility",
						note: geometry.note,
					},
	},
	transformation: {
		status: "not-applied",
		note: "Values are served source-exact; no geographic conversion or aggregation was applied.",
	},
});

test("publishes datasets, measures and source-exact population observations", () => {
	const datasets = routeWithData("/v1/datasets");
	assert.equal(datasets.status, 200);
	assert.deepEqual(
		"data" in datasets.body && datasets.body.data,
		dataCatalog.datasets,
	);

	const measure = routeWithData("/v1/measures/population-estimate");
	assert.equal(measure.status, 200);
	assert.deepEqual(
		"data" in measure.body && measure.body.data,
		dataCatalog.measures[0],
	);

	const first = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=1",
	);
	assert.equal(first.status, 200);
	const firstData = "data" in first.body ? first.body.data : undefined;
	assert.deepEqual(firstData, {
		measure: dataCatalog.measures[0],
		source: dataCatalog.measures[0]?.sources[0],
		period: "2022",
		sourceGeography: { type: "ward", boundaryYear: 2023 },
		provenance: populationProvenance(
			"population",
			"ward",
			"2022",
			populationObservations.contentHash,
		),
		conversion: null,
		aggregation: null,
		records: [populationObservations.records[0]],
	});
	const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
	assert.equal(typeof cursor, "string");
	const second = routeWithData(
		`/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=1&cursor=${cursor}`,
	);
	assert.deepEqual("data" in second.body && second.body.data, {
		measure: dataCatalog.measures[0],
		source: dataCatalog.measures[0]?.sources[0],
		period: "2022",
		sourceGeography: { type: "ward", boundaryYear: 2023 },
		provenance: populationProvenance(
			"population",
			"ward",
			"2022",
			populationObservations.contentHash,
		),
		conversion: null,
		aggregation: null,
		records: [populationObservations.records[1]],
	});

	const localAuthority = routeWithData(
		"/v1/data/population-estimate?period=2024&geography=localAuthority&boundaryYear=2023&areaCode=N09000001",
	);
	assert.equal(localAuthority.status, 200);
	assert.deepEqual(
		"data" in localAuthority.body && localAuthority.body.data,
		{
			measure: dataCatalog.measures[0],
			source: dataCatalog.measures[0]?.sources[1],
			period: "2024",
			sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
			provenance: populationProvenance(
				"population-uk",
				"localAuthority",
				"2024",
				populationLocalAuthorityObservations.contentHash,
			),
			conversion: null,
			aggregation: null,
			records: [
				{ areaCode: "N09000001", value: 400, status: "observed" },
			],
		},
	);

	const withGeometry = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&release=2023-05-uk-bgc&areaCode=E05000001",
	);
	assert.equal(withGeometry.status, 200);
	assert.deepEqual("data" in withGeometry.body && withGeometry.body.data, {
		measure: dataCatalog.measures[0],
		source: dataCatalog.measures[0]?.sources[0],
		period: "2022",
		sourceGeography: { type: "ward", boundaryYear: 2023 },
		geometry: {
			boundaryRelease: "2023-05-uk-bgc",
			selection: "caller-specified",
			compatibility: "code-set-compatible",
			areaIdentityTemplate: "ward/2023-05-uk-bgc/{areaCode}",
			note: "Values remain source-exact and are joined to this caller-selected geometry by matching area code. This is not a geometry conversion or an assertion of equal geometry.",
		},
		provenance: populationProvenance(
			"population",
			"ward",
			"2022",
			populationObservations.contentHash,
			{
				boundaryRelease: "2023-05-uk-bgc",
				compatibility: "code-set-compatible",
				note: "Values remain source-exact and are joined to this caller-selected geometry by matching area code. This is not a geometry conversion or an assertion of equal geometry.",
			},
		),
		conversion: null,
		aggregation: null,
		records: [populationObservations.records[0]],
	});

	const withArea = routeRequest(
		"GET",
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&release=2023-05-uk-bgc&areaCode=E05000001&include=area",
		{
			boundaryRegistry: registry,
			areaLookup: compatibleWardAreaLookup,
			dataCatalog,
			populationObservations,
			populationLocalAuthorityObservations,
			measureCompatibilityInventory,
		},
	);
	assert.equal(withArea.status, 200);
	const data = "data" in withArea.body ? withArea.body.data : undefined;
	assert.ok(data && typeof data === "object");
	assert.deepEqual((data as { records: unknown }).records, [
		{
			areaCode: "E05000001",
			value: 100,
			status: "observed",
			area: {
				id: "ward/2023-05-uk-bgc/E05000001",
				code: "E05000001",
				name: "Compatible ward",
			},
		},
	]);

	const includeWithoutRelease = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&include=area",
	);
	assert.equal(includeWithoutRelease.status, 400);

	const csv = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&areaCode=E05000001&format=csv",
	);
	assert.equal(csv.status, 200);
	assert.equal(csv.representation?.contentType, "text/csv; charset=utf-8");
	assert.equal(
		csv.representation?.body,
		'atlasRelease,measureId,unit,datasetId,period,geography,boundaryYear,boundaryRelease,geometryCompatibility,transformationStatus,areaCode,areaId,areaName,areaAliases,value,status,lowerBound,upperBound\n"sha256:registry","population-estimate","people","population","2022","ward","2023","","","not-applied","E05000001","","","","100","observed","",""\n',
	);

	const ndjson = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&areaCode=E05000001&format=ndjson",
	);
	assert.equal(ndjson.status, 200);
	assert.equal(
		ndjson.representation?.contentType,
		"application/x-ndjson; charset=utf-8",
	);
	assert.deepEqual(JSON.parse(String(ndjson.representation?.body)), {
		atlasRelease: "sha256:registry",
		measureId: "population-estimate",
		unit: "people",
		datasetId: "population",
		period: "2022",
		geography: "ward",
		boundaryYear: 2023,
		boundaryRelease: "",
		geometryCompatibility: "",
		transformationStatus: "not-applied",
		areaCode: "E05000001",
		areaId: "",
		areaName: "",
		areaAliases: "",
		value: 100,
		status: "observed",
		lowerBound: "",
		upperBound: "",
	});

	const csvPage = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=1&format=csv",
	);
	assert.equal(csvPage.status, 200);
	const pageCursor =
		"meta" in csvPage.body ? csvPage.body.meta.nextCursor : null;
	assert.equal(typeof pageCursor, "string");
	assert.equal(
		csvPage.representation?.headers?.link,
		`</v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=1&format=csv&cursor=${pageCursor}>; rel="next"`,
	);
	assert.equal(
		String(csvPage.representation?.body).trimEnd().split("\n").length,
		2,
	);

	const csvLastPage = routeWithData(
		`/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=1&format=csv&cursor=${pageCursor}`,
	);
	assert.equal(csvLastPage.status, 200);
	assert.deepEqual(csvLastPage.representation?.headers, {});

	const invalidFormat = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&format=parquet",
	);
	assert.equal(invalidFormat.status, 400);
});

test("returns a source-exact series without selecting a geometry release", () => {
	const response = routeWithData(
		"/v1/data/population-estimate/series?areaCode=N09000001&geography=localAuthority&boundaryYear=2023",
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && typeof data === "object");
	assert.deepEqual((data as { series: unknown }).series, [
		{
			period: "2022",
			areaCode: "N09000001",
			value: 380,
			status: "observed",
		},
		{
			period: "2023",
			areaCode: "N09000001",
			value: 390,
			status: "observed",
		},
		{
			period: "2024",
			areaCode: "N09000001",
			value: 400,
			status: "observed",
		},
	]);
	assert.deepEqual(
		(data as { provenance: { source: { observations: unknown } } })
			.provenance.source.observations,
		{
			artifact: "population-local-authority-observations",
			contentHash: "sha256:population-local-authority-observations",
			periods: ["2022", "2023", "2024"],
		},
	);

	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/series?areaCode=N09000001&geography=localAuthority&boundaryYear=2023&release=2023-05-uk-bgc",
		).status,
		422,
	);
	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/series?areaCode=unknown&geography=localAuthority&boundaryYear=2023",
		).status,
		404,
	);
});

test("ranks one source-exact partition with stable cursors", () => {
	const first = routeWithData(
		"/v1/data/population-estimate/rankings?period=2022&geography=ward&boundaryYear=2023&limit=1",
	);
	assert.equal(first.status, 200);
	const firstData = "data" in first.body ? first.body.data : undefined;
	assert.ok(firstData && typeof firstData === "object");
	assert.deepEqual((firstData as { records: unknown }).records, [
		{
			areaCode: "W05000001",
			value: 200,
			status: "observed",
			rank: 1,
			tieCount: 1,
		},
	]);
	assert.deepEqual((firstData as { ranking: unknown }).ranking, {
		order: "desc",
		method: "competition",
		note: "Equal values share a rank; the following rank accounts for every preceding observation (for example 1, 1, 3).",
	});
	const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
	assert.equal(typeof cursor, "string");
	const second = routeWithData(
		`/v1/data/population-estimate/rankings?period=2022&geography=ward&boundaryYear=2023&limit=1&cursor=${cursor}`,
	);
	assert.deepEqual(
		"data" in second.body &&
			(second.body.data as { records: unknown }).records,
		[
			{
				areaCode: "E05000001",
				value: 100,
				status: "observed",
				rank: 2,
				tieCount: 1,
			},
		],
	);

	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/rankings?period=2022&geography=ward&boundaryYear=2023&order=sideways",
		).status,
		400,
	);
	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/rankings?period=2022&geography=ward&boundaryYear=2023&release=2023-05-uk-bgc",
		).status,
		422,
	);
});

test("aggregates a region through an explicit complete crosswalk", () => {
	const crosswalkId = "local-authority-to-region-fixture";
	const regionalCrosswalk: CrosswalkArtifact = {
		schemaVersion: 1,
		contentHash: "sha256:regional-crosswalk",
		id: crosswalkId,
		method: "area-overlap",
		quality: "derived",
		weighting: {
			status: "provided",
			basis: "area",
			normalisation: "per-source",
		},
		from: {
			geography: "localAuthority",
			boundaryRelease: "2025-12-uk-lad",
		},
		to: { geography: "region", boundaryRelease: "2025-12-en-rgn" },
		provenance: {
			inputs: [
				{ side: "from", input: "fixture-lad", inputHash: "sha256:lad" },
				{
					side: "to",
					input: "fixture-region",
					inputHash: "sha256:region",
				},
			],
			areaProjection: "EPSG:6933",
			clipping: "fixture",
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
				from: {
					status: "verified",
					availableAreaCount: 1,
					referencedCodeCount: 1,
				},
				to: {
					status: "verified",
					availableAreaCount: 1,
					referencedCodeCount: 1,
				},
			},
			overlap: {
				candidatePairCount: 1,
				intersectingPairCount: 1,
				sliverPairCount: 0,
				sliverWidthM: 100,
				widestSliverWidthM: null,
				narrowestOverlapWidthM: 1000,
				minimumCoverage: 0.99,
				minimumSourceCoverage: 1,
				minimumTargetCoverage: 1,
			},
		},
		records: [
			{
				source: {
					code: "E06000001",
					labels: ["Greater Manchester"],
					areaM2: 1,
					coverage: 1,
				},
				targets: [
					{
						code: "E12000002",
						labels: ["North West"],
						weight: 1,
						overlapAreaM2: 1,
						sourceShare: 1,
						targetShare: 1,
					},
				],
			},
		],
	};
	const compatibility: MeasureCompatibilityInventory = {
		...measureCompatibilityInventory,
		measures: [
			...measureCompatibilityInventory.measures,
			{
				measureId: "ghg-emissions",
				sources: [
					{
						datasetId: "ghg-emissions",
						sourceGeography: {
							type: "localAuthority",
							boundaryYear: 2025,
						},
						periods: ["2024"],
						candidates: [
							{
								boundaryRelease: "2025-12-uk-lad",
								title: "Fixture local authorities",
								coverageCountries: ["GB-ENG"],
								status: "exact-code-set",
								sourceCodeCount: 1,
								candidateCodeCount: 1,
								matchingCodeCount: 1,
								matchedSourceShare: 1,
								unmatchedSourceCodeCount: 0,
								unmatchedSourceCodeSample: [],
								candidateOnlyCodeCount: 0,
								candidateOnlyCodeSample: [],
							},
						],
						note: "Fixture compatibility.",
					},
				],
			},
		],
	};
	const response = routeWithCatalog(
		`/v1/data/ghg-emissions/aggregate?period=2024&geography=localAuthority&boundaryYear=2025&regionCode=E12000002&sourceRelease=2025-12-uk-lad&crosswalk=${crosswalkId}`,
		dataCatalog,
		measureObservations,
		{
			crosswalkLookup: new Map([
				...crosswalkLookup,
				[crosswalkId, regionalCrosswalk],
			]),
			measureCompatibilityInventory: compatibility,
		},
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body &&
			(response.body.data as { record: unknown }).record,
		{ value: 400, status: "derived" },
	);
	assert.equal(
		"data" in response.body &&
			(response.body.data as { aggregation: { membership: string } })
				.aggregation.membership,
		"verified-full-area-overlap",
	);
});

test("aggregates an intensive measure with its published weight", () => {
	const shareId = "fixture-party-vote-share";
	const weightId = "fixture-valid-votes";
	const source: MeasureSource = {
		datasetId: "population",
		periods: ["2024"],
		sourceGeography: { type: "ward" as const, boundaryYear: 2023 },
		coverage: {
			kind: "partial" as const,
			countries: ["GB-ENG"],
			recordCount: 2,
			note: "Fixture observations.",
		},
	};
	const catalog: DataCatalog = {
		...dataCatalog,
		measures: [
			...dataCatalog.measures,
			{
				id: weightId,
				label: "Fixture valid votes",
				valueKind: "count",
				unit: "votes",
				aggregation: {
					kind: "extensive",
					operation: "sum",
					available: true,
				},
				sources: [source],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: true,
				},
				links: { data: `/v1/data/${weightId}` },
			},
			{
				id: shareId,
				label: "Fixture party vote share",
				valueKind: "ratio",
				unit: "percent",
				aggregation: {
					kind: "intensive",
					operation: "weighted-mean",
					weight: {
						description: "Valid ballot papers.",
						datasetField: "validVotes",
						measureId: weightId,
					},
					available: true,
				},
				sources: [source],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: true,
				},
				links: { data: `/v1/data/${shareId}` },
			},
		],
	};
	const artifact = (
		measureId: string,
		values: number[],
	): MeasureObservationArtifact => ({
		schemaVersion: 1,
		contentHash: `sha256:${measureId}`,
		measureId,
		sourceGeography: source.sourceGeography,
		periods: [
			{
				period: "2024",
				records: values.map((value, index) => ({
					areaCode: `E0500000${index + 1}`,
					value,
					status: "observed" as const,
				})),
			},
		],
	});
	const response = routeWithCatalog(
		`/v1/data/${shareId}/aggregate?period=2024&geography=ward&boundaryYear=2023&areaCode=E92000001`,
		catalog,
		[
			...measureObservations,
			artifact(shareId, [25, 80]),
			artifact(weightId, [100, 400]),
		],
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body &&
			(response.body.data as { record: { value: number } }).record.value,
		69,
	);
	assert.deepEqual(
		"data" in response.body &&
			(response.body.data as { aggregation: { operation: string } })
				.aggregation.operation,
		"weighted-mean",
	);
});

test("serves categorical winners without numeric operations", () => {
	const measureId = "general-election-winning-party";
	const catalog: DataCatalog = {
		...dataCatalog,
		measures: [
			...dataCatalog.measures,
			{
				id: measureId,
				label: "General election winning party",
				valueKind: "categorical",
				unit: "party",
				aggregation: {
					kind: "categorical",
					available: false,
					note: "A winning-party label cannot be combined numerically.",
				},
				sources: [
					{
						datasetId: "general-election",
						periods: ["2024"],
						sourceGeography: { type: "ward", boundaryYear: 2024 },
						coverage: {
							kind: "partial",
							countries: ["GB-ENG", "GB-WLS"],
							recordCount: 2,
							note: "Fixture winners.",
						},
					},
				],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: false,
				},
				links: { data: `/v1/data/${measureId}` },
			},
		],
	};
	const winners: MeasureObservationArtifact<CategoricalObservation> = {
		schemaVersion: 1,
		contentHash: "sha256:winners",
		measureId,
		sourceGeography: { type: "ward", boundaryYear: 2024 },
		periods: [
			{
				period: "2024",
				records: [
					{
						areaCode: "E05000001",
						category: "LAB",
						status: "observed",
					},
					{
						areaCode: "W05000001",
						category: "PC",
						status: "observed",
					},
				],
			},
		],
	};
	const response = routeWithCatalog(
		`/v1/data/${measureId}?period=2024&geography=ward&boundaryYear=2024`,
		catalog,
		[...measureObservations, winners],
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body &&
			(response.body.data as { records: unknown }).records,
		[
			{ areaCode: "E05000001", category: "LAB", status: "observed" },
			{ areaCode: "W05000001", category: "PC", status: "observed" },
		],
	);
	assert.equal(
		routeWithCatalog(
			`/v1/data/${measureId}/rankings?period=2024&geography=ward&boundaryYear=2024`,
			catalog,
			[...measureObservations, winners],
		).status,
		422,
	);
	assert.equal(
		routeWithCatalog(
			`/v1/data/${measureId}?period=2024&geography=ward&boundaryYear=2024&format=csv`,
			catalog,
			[...measureObservations, winners],
		).status,
		422,
	);
});

test("compares two source-exact areas in an explicit direction", () => {
	const response = routeWithData(
		"/v1/data/population-estimate/compare?period=2022&geography=ward&boundaryYear=2023&baselineAreaCode=E05000001&comparisonAreaCode=W05000001",
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && typeof data === "object");
	assert.deepEqual((data as { comparison: unknown }).comparison, {
		baseline: { areaCode: "E05000001", value: 100, status: "observed" },
		comparison: { areaCode: "W05000001", value: 200, status: "observed" },
		difference: {
			direction: "comparison-minus-baseline",
			value: 100,
			unit: "people",
			interpretation: "Difference in the source-published unit.",
		},
		relativeDifference: {
			value: 1,
			basis: "(comparison - baseline) / baseline",
		},
	});
	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/compare?period=2022&geography=ward&boundaryYear=2023&baselineAreaCode=E05000001&comparisonAreaCode=E05000001",
		).status,
		400,
	);
	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/compare?period=2022&geography=ward&boundaryYear=2023&baselineAreaCode=E05000001&comparisonAreaCode=W05000001&release=2023-05-uk-bgc",
		).status,
		422,
	);
});

test("serves greenhouse gas emissions as a second source-exact measure", () => {
	const measures = routeWithData("/v1/measures");
	assert.deepEqual(
		"data" in measures.body
			? (measures.body.data as Array<{ id: string }>).map(
					(measure) => measure.id,
				)
			: [],
		[
			"population-estimate",
			"ghg-emissions",
			"mobile-5g-coverage",
			"travel-to-work-car",
			"house-price-median",
			"small-area-fixture",
		],
	);

	const observed = routeWithData(
		"/v1/data/ghg-emissions?period=2024&geography=localAuthority&boundaryYear=2025",
	);
	assert.equal(observed.status, 200);
	const data = "data" in observed.body ? (observed.body.data as never) : {};
	assert.deepEqual((data as { records: unknown }).records, [
		{ areaCode: "E06000001", value: 400, status: "observed" },
	]);
	// The provenance names the emissions artifact, not a population one.
	assert.equal(
		(
			data as {
				provenance: { source: { observations: { artifact: string } } };
			}
		).provenance.source.observations.artifact,
		"ghg-emissions-observations",
	);

	// A period the measure does not publish is rejected, not served empty.
	assert.equal(
		routeWithData(
			"/v1/data/ghg-emissions?period=1999&geography=localAuthority&boundaryYear=2025",
		).status,
		400,
	);
	// So is the population measure's own code vintage.
	assert.equal(
		routeWithData(
			"/v1/data/ghg-emissions?period=2024&geography=localAuthority&boundaryYear=2023",
		).status,
		400,
	);
	assert.equal(
		routeWithData("/v1/data/not-a-measure?period=2024").status,
		404,
	);
});

test("carries the measure's unit into a tabular export", () => {
	const csv = routeWithData(
		"/v1/data/ghg-emissions?period=2024&geography=localAuthority&boundaryYear=2025&format=csv",
	);
	assert.equal(csv.status, 200);
	const [header, first] = String(csv.representation?.body).split("\n");
	assert.ok(header?.startsWith("atlasRelease,measureId,unit,"));
	// Without the unit a saved emissions file is indistinguishable from people.
	assert.ok(first?.includes('"kt CO2e"'));
});

test("declares a coverage share as intensive, so it is never summed", () => {
	const measures = routeWithData("/v1/measures");
	assert.deepEqual(
		"data" in measures.body
			? (
					measures.body.data as Array<{
						id: string;
						aggregation: { kind: string };
					}>
				).map((measure) => [measure.id, measure.aggregation.kind])
			: [],
		[
			["population-estimate", "extensive"],
			["ghg-emissions", "extensive"],
			["mobile-5g-coverage", "intensive"],
			["travel-to-work-car", "extensive"],
			["house-price-median", "non-aggregatable"],
			["small-area-fixture", "extensive"],
		],
	);

	const measure = routeWithData("/v1/measures/mobile-5g-coverage");
	const aggregation =
		"data" in measure.body
			? (measure.body.data as { aggregation: Record<string, unknown> })
					.aggregation
			: undefined;
	// A share cannot be added, and the weight it would need is named rather
	// than silently assumed.
	assert.equal(aggregation?.kind, "intensive");
	assert.equal(aggregation?.operation, "weighted-mean");
	assert.deepEqual(aggregation?.weight, {
		description: "The authority's premises count.",
		datasetField: "premisesCount",
	});
	assert.equal(aggregation?.available, false);

	const observed = routeWithData(
		"/v1/data/mobile-5g-coverage?period=2025&geography=localAuthority&boundaryYear=2024",
	);
	assert.equal(observed.status, 200);
	const data = "data" in observed.body ? (observed.body.data as never) : {};
	assert.deepEqual((data as { records: unknown }).records, [
		{ areaCode: "E06000001", value: 40.5, status: "observed" },
	]);
	assert.equal(
		(
			data as {
				provenance: { source: { observations: { artifact: string } } };
			}
		).provenance.source.observations.artifact,
		"mobile-5g-coverage-observations",
	);

	// The emissions code vintage is not this measure's.
	assert.equal(
		routeWithData(
			"/v1/data/mobile-5g-coverage?period=2025&geography=localAuthority&boundaryYear=2025",
		).status,
		400,
	);
});

test("publishes a census breakdown as counts with its own denominator", () => {
	const observed = routeWithData(
		"/v1/data/travel-to-work-car?period=2021&geography=localAuthority&boundaryYear=2025",
	);
	assert.equal(observed.status, 200);
	const data = "data" in observed.body ? (observed.body.data as never) : {};
	assert.deepEqual((data as { records: unknown }).records, [
		{ areaCode: "E06000001", value: 24724, status: "observed" },
	]);

	const measure = routeWithData("/v1/measures/travel-to-work-car");
	const published =
		"data" in measure.body
			? (measure.body.data as {
					valueKind: string;
					unit: string;
					aggregation: { kind: string };
					notes: string[];
				})
			: undefined;
	// A count of people adds over areas, so no weight is needed. The universe
	// is stated, because a share of the wrong denominator is the likelier error.
	assert.equal(published?.valueKind, "count");
	assert.equal(published?.unit, "people in employment");
	assert.equal(published?.aggregation.kind, "extensive");
	assert.match(published?.notes[0] ?? "", /aged 16 and over in employment/);
	assert.match(
		published?.notes.join(" ") ?? "",
		/created in April 2023 are compiled by summing their predecessors/,
	);
});

test("sums a country from the GSS code prefix, or refuses to", () => {
	const query =
		"/v1/data/ghg-emissions/aggregate?period=2024&geography=localAuthority&boundaryYear=2025";

	const england = routeWithData(`${query}&areaCode=E92000001`);
	assert.equal(england.status, 200);
	const data =
		"data" in england.body
			? (england.body.data as {
					record: { value: number; status: string };
					aggregation: {
						membership: string;
						inputRecordCount: number;
					};
				})
			: undefined;
	assert.equal(data?.record.value, 400);
	assert.equal(data?.record.status, "derived");
	// Membership is definitional, not a geometric comparison.
	assert.equal(data?.aggregation.membership, "gss-country-code");
	assert.equal(data?.aggregation.inputRecordCount, 1);

	// A country the partition does not reach must not sum to a confident zero.
	const scotland = routeWithData(`${query}&areaCode=S92000003`);
	assert.equal(scotland.status, 422);
	assert.match(
		"detail" in scotland.body ? scotland.body.detail : "",
		/publishes no areas for that country/,
	);

	// Exactly one of the two ways of naming an area.
	assert.equal(routeWithData(query).status, 400);
	assert.equal(
		routeWithData(
			`${query}&areaCode=E92000001&locationId=greater-manchester`,
		).status,
		400,
	);
	// A local authority is not yet an aggregation target.
	assert.equal(routeWithData(`${query}&areaCode=E06000001`).status, 400);
});

test("serves a small-area partition on its own geography", () => {
	const observed = routeWithData(
		"/v1/data/small-area-fixture?period=2019&geography=lsoa&boundaryYear=2011",
	);
	assert.equal(observed.status, 200);
	const data = "data" in observed.body ? (observed.body.data as never) : {};
	assert.deepEqual((data as { sourceGeography: unknown }).sourceGeography, {
		type: "lsoa",
		boundaryYear: 2011,
	});
	assert.equal((data as { records: unknown[] }).records.length, 2);

	// An LSOA partition is not a data zone partition, even for the same year.
	assert.equal(
		routeWithData(
			"/v1/data/small-area-fixture?period=2019&geography=dataZone&boundaryYear=2011",
		).status,
		400,
	);
});

test("refuses to combine a median, and says why", () => {
	const observed = routeWithData(
		"/v1/data/house-price-median?period=2022&geography=ward&boundaryYear=2020",
	);
	assert.equal(observed.status, 200);

	const aggregate = routeWithData(
		"/v1/data/house-price-median/aggregate?period=2022&geography=ward&boundaryYear=2020&areaCode=E92000001",
	);
	assert.equal(aggregate.status, 422);
	assert.match(
		"detail" in aggregate.body ? aggregate.body.detail : "",
		/is a median and cannot be combined over areas\. A median of ward medians/,
	);

	const convert = routeWithData(
		`/v1/data/house-price-median/convert?period=2022&geography=ward&boundaryYear=2020&crosswalk=${crosswalkArtifact.id}`,
	);
	assert.equal(convert.status, 422);
	assert.match(
		"detail" in convert.body ? convert.body.detail : "",
		/This measure is a median/,
	);
});

test("converts a measure only through a crosswalk the caller names", () => {
	const base =
		"/v1/data/population-estimate/convert?period=2022&geography=ward&boundaryYear=2023";

	// The route never picks a conversion path on the caller's behalf.
	assert.equal(routeWithData(base).status, 400);
	assert.equal(routeWithData(`${base}&crosswalk=not-published`).status, 404);

	// A crosswalk that starts somewhere else cannot convert this partition.
	const wrongStart = routeWithData(
		`${base}&crosswalk=${crosswalkArtifact.id}`,
	);
	assert.equal(wrongStart.status, 422);
	assert.match(
		"detail" in wrongStart.body ? wrongStart.body.detail : "",
		/starts at constituency/,
	);
	assert.equal(
		"code" in wrongStart.body && wrongStart.body.code,
		"conversion_not_available",
	);
	assert.equal(
		"absence" in wrongStart.body && wrongStart.body.absence,
		"crosswalk-geography-mismatch",
	);

	// A source area the crosswalk does not map would drop out of the total.
	const unmapped = routeWithData(
		`${base}&crosswalk=${containmentCrosswalk.id}`,
	);
	assert.equal(unmapped.status, 422);
	assert.deepEqual(
		"code" in unmapped.body && {
			code: unmapped.body.code,
			absence: unmapped.body.absence,
			areaCount: unmapped.body.areaCount,
			areaSample: unmapped.body.areaSample,
		},
		{
			code: "conversion_not_available",
			absence: "source-areas-not-mapped",
			areaCount: 1,
			areaSample: ["W05000001"],
		},
	);

	// A share cannot be regrouped by adding it up.
	const intensive = routeWithData(
		`/v1/data/mobile-5g-coverage/convert?period=2025&geography=localAuthority&boundaryYear=2024&crosswalk=${crosswalkArtifact.id}`,
	);
	assert.equal(intensive.status, 422);
	assert.match(
		"detail" in intensive.body ? intensive.body.detail : "",
		/Only an extensive measure can be converted/,
	);
	assert.equal(
		"code" in intensive.body && intensive.body.code,
		"aggregation_not_supported",
	);
});

test("publishes measure boundary candidates as code compatibility only", () => {
	const response = routeRequest(
		"GET",
		"/v1/measures/population-estimate/compatibility",
		{
			boundaryRegistry: registry,
			measureCompatibilityInventory,
		},
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && typeof data === "object");
	assert.equal(
		(data as { sources: Array<{ candidates: Array<{ status: string }> }> })
			.sources[0]?.candidates[0]?.status,
		"code-set-compatible",
	);
	assert.match(
		(data as { note: string }).note,
		/do not select a geometry release/,
	);
});

test("publishes source and boundary code coverage without claiming equal geometry", () => {
	const response = routeWithData("/v1/measures/population-estimate/coverage");
	assert.equal(response.status, 200);
	assert.deepEqual("data" in response.body && response.body.data, {
		measure: {
			id: "population-estimate",
			valueKind: "count",
			unit: "people",
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: true,
			},
			href: "/v1/measures/population-estimate",
		},
		sources: [
			{
				dataset: { id: "population", href: "/v1/datasets/population" },
				periods: ["2022"],
				sourceGeography: { type: "ward", boundaryYear: 2023 },
				sourceCoverage: dataCatalog.measures[0]?.sources[0]?.coverage,
				boundaryCoverage: [
					{
						boundaryRelease: "2023-05-uk-bgc",
						title: "Wards, May 2023",
						coverageCountries: ["GB-ENG", "GB-WLS"],
						status: "code-set-compatible",
						sourceAreaCount: 2,
						boundaryAreaCount: 3,
						matchingSourceAreaCount: 2,
						matchingSourceAreaShare: 1,
						unmatchedSourceAreaCount: 0,
						candidateOnlyAreaCount: 1,
						eligibleForCodeJoin: true,
					},
				],
				assessment: {
					status: "assessed",
					href: "/v1/measures/population-estimate/compatibility",
					note: "Boundary coverage compares area-code membership only; it does not assert equal geometry.",
				},
			},
			{
				dataset: {
					id: "population-uk",
					href: "/v1/datasets/population-uk",
				},
				periods: ["2022", "2023", "2024"],
				sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
				sourceCoverage: dataCatalog.measures[0]?.sources[1]?.coverage,
				boundaryCoverage: [],
				assessment: {
					status: "not-assessed",
					note: "No boundary code-coverage assessment has been published for this source partition.",
				},
			},
		],
	});

	const missing = routeWithData("/v1/measures/unknown/coverage");
	assert.equal(missing.status, 404);
});

test("keeps aggregation separate from the source-exact observation route", () => {
	const invalidSource = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2024",
	);
	assert.equal(invalidSource.status, 400);
	const incompatibleRelease = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&release=2023-12-uk-bgc",
	);
	assert.equal(incompatibleRelease.status, 422);
	const aggregation = routeWithData(
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&aggregate=sum",
	);
	assert.equal(aggregation.status, 422);
});

test("aggregates an extensive measure only over a complete direct named-location match", () => {
	const context: RouteContext = {
		boundaryRegistry: registry,
		// The compiled releases are what tell a member code of another vintage
		// from one that is simply wrong, so aggregation needs them.
		areaLookup,
		namedLocationLookup: aggregationNamedLocationLookup,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	};
	const response = routeRequest(
		"GET",
		"/v1/data/population-estimate/aggregate?period=2022&geography=ward&boundaryYear=2023&locationId=test-wards",
		context,
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual(
		(
			data as {
				aggregation: unknown;
				record: unknown;
				provenance: { transformation: unknown };
			}
		).aggregation,
		{
			operation: "sum",
			membership: "direct-code-match",
			inputRecordCount: 2,
			note: "Every curated location member code that names an area in this partition was found in the published source partition.",
		},
	);
	assert.deepEqual((data as { record: unknown }).record, {
		value: 300,
		status: "derived",
	});
	assert.deepEqual(
		(data as { provenance: { transformation: unknown } }).provenance
			.transformation,
		{
			status: "not-applied",
			note: "Input observations are source-exact; no geographic conversion was applied.",
		},
	);

	// E05000999 names no area in any compiled release, so it matched nothing
	// and could neither add to the sum nor be counted twice in it. The sum
	// proceeds and names the code it passed over, rather than refusing a
	// question it can answer.
	const withLegacy = routeRequest(
		"GET",
		"/v1/data/population-estimate/aggregate?period=2022&geography=ward&boundaryYear=2023&locationId=incomplete-test-wards",
		context,
	);
	assert.equal(withLegacy.status, 200);
	const legacyData = withLegacy.body as {
		data: {
			aggregation: {
				inputRecordCount: number;
				memberCodesNotInPartition: {
					otherVintage: string[];
					legacyAliases: string[];
				};
			};
		};
	};
	assert.equal(legacyData.data.aggregation.inputRecordCount, 1);
	assert.deepEqual(legacyData.data.aggregation.memberCodesNotInPartition, {
		otherVintage: [],
		legacyAliases: ["E05000999"],
	});

	// Without the compiled releases there is nothing to classify against, so an
	// unresolved code is refused rather than assumed to be harmless.
	const unverifiable = routeRequest(
		"GET",
		"/v1/data/population-estimate/aggregate?period=2022&geography=ward&boundaryYear=2023&locationId=incomplete-test-wards",
		{ ...context, areaLookup: undefined },
	);
	assert.equal(unverifiable.status, 503);

	const intensive = routeRequest(
		"GET",
		"/v1/data/mobile-5g-coverage/aggregate?period=2025&geography=localAuthority&boundaryYear=2024&locationId=test-wards",
		context,
	);
	assert.equal(intensive.status, 422);

	const conversion = routeRequest(
		"GET",
		"/v1/data/population-estimate/aggregate?period=2022&geography=ward&boundaryYear=2023&locationId=test-wards&release=2023-05-uk-bgc",
		context,
	);
	assert.equal(conversion.status, 422);
});

test("lists published geographies", () => {
	const response = route("GET", "/v1/geographies", registry);
	assert.equal(response.status, 200);
	assert.deepEqual(response.body, {
		apiVersion: "v1",
		atlasRelease: "sha256:registry",
		data: [
			{ id: "ward", latestRelease: "2025-01-en-ward", releaseCount: 1 },
		],
		meta: { nextCursor: null },
	});
});

test("gets one boundary release", () => {
	const response = route(
		"GET",
		"/v1/boundary-releases/ward/2025-01-en-ward",
		registry,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body && response.body.data,
		registry.releases[0],
	);
});

test("publishes the geography compiler coverage", () => {
	const response = route(
		"GET",
		"/v1/geography-inventory",
		registry,
		geographyInventory,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body && response.body.data,
		geographyInventory,
	);
});

test("gets a compiled area by its full identity", () => {
	const response = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual("data" in response.body && response.body.data, {
		id: "ward/2025-01-en-ward/E05000001",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		code: "E05000001",
		name: "Example ward",
		aliases: ["Enghraifft ward"],
	});
});

test("gets an area's geometry as a GeoJSON Feature", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Point",
							coordinates: [-2.24, 53.48],
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const areaGeometryCache = new AreaGeometryCache(root, sources);

		const response = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(response.status, 200);
		assert.deepEqual("data" in response.body && response.body.data, {
			type: "Feature",
			id: "ward/2025-01-en-ward/E05000001",
			properties: {
				id: "ward/2025-01-en-ward/E05000001",
				geography: "ward",
				boundaryRelease: "2025-01-en-ward",
				code: "E05000001",
				name: "Example ward",
				aliases: ["Enghraifft ward"],
				// Full resolution by default, and no method block with it:
				// nothing was done to the geometry to explain.
				generalisation: {
					tier: "full",
					toleranceM: 0,
					minEffectiveAreaM2: 0,
					vertices: 1,
					verticesAtFullResolution: 1,
					parts: 0,
					partsAtFullResolution: 0,
				},
				geometrySource: { sourceCrs: "EPSG:4326" },
			},
			geometry: { type: "Point", coordinates: [-2.24, 53.48] },
		});

		const unknownArea = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05099999/geometry",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(unknownArea.status, 404);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("finds every area containing a point and labels shared borders", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[0, 0],
									[3, 0],
									[3, 3],
									[0, 3],
									[0, 0],
								],
								[
									[1, 1],
									[2, 1],
									[2, 2],
									[1, 2],
									[1, 1],
								],
							],
						},
					},
					{
						properties: { WD25CD: "E05000002" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[3, 0],
									[4, 0],
									[4, 3],
									[3, 3],
									[3, 0],
								],
							],
						},
					},
				],
			}),
		);
		const areaGeometryCache = new AreaGeometryCache(
			root,
			new Map([
				[
					"ward/2025-01-en-ward",
					{
						input: "boundaries/ward/2025-01-en-ward/wards.geojson",
						crs: "EPSG:4326",
						codeProperty: "WD25CD",
					},
				],
			]),
		);

		const boundary = route(
			"GET",
			"/v1/areas:contains?lng=3&lat=0.5&geography=ward&release=2025-01-en-ward",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(boundary.status, 200);
		const data = "data" in boundary.body ? boundary.body.data : undefined;
		assert.deepEqual(data, {
			point: { lng: 3, lat: 0.5 },
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			boundaryRule: "included",
			matches: [
				{
					id: "ward/2025-01-en-ward/E05000001",
					code: "E05000001",
					name: "Example ward",
					aliases: ["Enghraifft ward"],
					containment: "boundary",
					geometrySource: { sourceCrs: "EPSG:4326" },
				},
				{
					id: "ward/2025-01-en-ward/E05000002",
					code: "E05000002",
					name: "Other ward",
					containment: "boundary",
					geometrySource: { sourceCrs: "EPSG:4326" },
				},
			],
		});

		const hole = route(
			"GET",
			"/v1/areas:contains?lng=1.5&lat=1.5&geography=ward&release=2025-01-en-ward",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(hole.status, 200);
		assert.deepEqual("data" in hole.body && hole.body.data, {
			point: { lng: 1.5, lat: 1.5 },
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			boundaryRule: "included",
			matches: [],
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("validates point lookup coordinates and reports unavailable geometry", () => {
	const invalid = route(
		"GET",
		"/v1/areas:contains?lng=181&lat=53&geography=ward&release=2025-01-en-ward",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(invalid.status, 400);

	const unavailable = route(
		"GET",
		"/v1/areas:contains?lng=-2&lat=53&geography=ward&release=2025-01-en-ward",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(unavailable.status, 503);
});

test("reports geometry as unavailable before the geometry cache is built", () => {
	const response = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/geometry",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 503);
});

test("surfaces a missing or unsupported geometry source as a clear error", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const noSourceCache = new AreaGeometryCache(root, new Map());
		const noSource = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			noSourceCache,
		);
		assert.equal(noSource.status, 503);
		assert.equal(
			"title" in noSource.body && noSource.body.title,
			"Geometry Unavailable",
		);

		const nonWgs84Sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:3857",
					codeProperty: "WD25CD",
				},
			],
		]);
		const nonWgs84Cache = new AreaGeometryCache(root, nonWgs84Sources);
		const nonWgs84 = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			nonWgs84Cache,
		);
		assert.equal(nonWgs84.status, 503);
		assert.match(
			"detail" in nonWgs84.body ? nonWgs84.body.detail : "",
			/No transformation to WGS84 is available for geometry in EPSG:3857\./,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("searches and paginates compiled area identities", () => {
	const byCode = route(
		"GET",
		"/v1/areas?q=e05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(byCode.status, 200);
	assert.deepEqual("data" in byCode.body && byCode.body.data, [
		{
			id: "ward/2025-01-en-ward/E05000001",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			code: "E05000001",
			name: "Example ward",
			aliases: ["Enghraifft ward"],
		},
	]);

	const byAlias = route(
		"GET",
		"/v1/areas?q=gm",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(byAlias.status, 200);
	assert.deepEqual("data" in byAlias.body && byAlias.body.data, [
		{
			id: "localAuthority/2025-01-uk-lad/E08000001",
			geography: "localAuthority",
			boundaryRelease: "2025-01-uk-lad",
			code: "E08000001",
			name: "Greater Manchester",
			aliases: ["GM"],
		},
	]);

	const first = route(
		"GET",
		"/v1/areas?geography=ward&limit=1",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(first.status, 200);
	assert.deepEqual("data" in first.body && first.body.data, [
		{
			id: "ward/2025-01-en-ward/E05000001",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			code: "E05000001",
			name: "Example ward",
			aliases: ["Enghraifft ward"],
		},
	]);
	const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
	assert.equal(typeof cursor, "string");
	assert.ok(cursor);

	const second = route(
		"GET",
		"/v1/areas?geography=ward&limit=1&cursor=" + cursor,
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(second.status, 200);
	assert.deepEqual("data" in second.body && second.body.data, [
		{
			id: "ward/2025-01-en-ward/E05000002",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			code: "E05000002",
			name: "Other ward",
		},
	]);
	assert.equal("meta" in second.body && second.body.meta.nextCursor, null);
});

test("navigates published relationships in both directions", () => {
	const ward = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/relationships",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(ward.status, 200);
	assert.deepEqual("data" in ward.body && ward.body.data, {
		id: "ward/2025-01-en-ward/E05000001",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		code: "E05000001",
		name: "Example ward",
		aliases: ["Enghraifft ward"],
		relationships: [
			{
				relation: "within",
				counterpart: {
					id: "localAuthority/2025-01-uk-lad/E08000001",
					geography: "localAuthority",
					boundaryRelease: "2025-01-uk-lad",
					code: "E08000001",
					labels: ["Greater Manchester"],
				},
				crosswalk: {
					id: "ward-to-local-authority-2025",
					method: "clean-containment",
					quality: "publisher-supplied",
					weighting: { status: "not-applicable" },
				},
			},
		],
	});

	const localAuthority = route(
		"GET",
		"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/relationships",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(localAuthority.status, 200);
	const data =
		"data" in localAuthority.body ? localAuthority.body.data : undefined;
	assert.ok(data && typeof data === "object" && "relationships" in data);
	assert.deepEqual((data as { relationships: unknown }).relationships, [
		{
			relation: "contains",
			counterpart: {
				id: "ward/2025-01-en-ward/E05000001",
				geography: "ward",
				boundaryRelease: "2025-01-en-ward",
				code: "E05000001",
				labels: ["Example ward"],
			},
			crosswalk: {
				id: "ward-to-local-authority-2025",
				method: "clean-containment",
				quality: "publisher-supplied",
				weighting: { status: "not-applicable" },
			},
		},
	]);
});

test("offers focused parent and child containment routes", () => {
	const parents = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/parents",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(parents.status, 200);
	const parentData = "data" in parents.body ? parents.body.data : undefined;
	assert.ok(parentData && typeof parentData === "object");
	assert.equal(
		(parentData as { relationships: Array<{ relation: string }> })
			.relationships[0]?.relation,
		"within",
	);

	const children = route(
		"GET",
		"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(children.status, 200);
	const childData = "data" in children.body ? children.body.data : undefined;
	assert.ok(childData && typeof childData === "object");
	assert.equal(
		(childData as { relationships: Array<{ relation: string }> })
			.relationships[0]?.relation,
		"contains",
	);
});

test("reports same-code continuity without calling it an exact historical match", () => {
	const historyLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:ward-2024",
			geography: "ward",
			boundaryRelease: "2024-01-en-ward",
			codeProperty: "WD24CD",
			nameProperty: "WD24NM",
			areas: [{ code: "E05000001", name: "Example ward" }],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:ward-2025",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [{ code: "E05000001", name: "Example ward" }],
		},
	]);
	const response = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001/history",
		registry,
		geographyInventory,
		historyLookup,
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual((data as { sameCodeReleases: unknown }).sameCodeReleases, [
		{
			id: "ward/2024-01-en-ward/E05000001",
			geography: "ward",
			boundaryRelease: "2024-01-en-ward",
			code: "E05000001",
			name: "Example ward",
			status: "same-code-continuity",
		},
	]);
	assert.match(
		(data as { note: string }).note,
		/does not assert unchanged geometry/,
	);
});

test("translates codes only through a crosswalk valid for the requested purpose", () => {
	const response = route(
		"GET",
		"/v1/translations?sourceGeography=constituency&sourceRelease=2010&code=E14000001&targetGeography=constituency&targetRelease=2024-07-uk-bgc&purpose=identity",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual((data as { matches: unknown }).matches, [
		{
			crosswalk: {
				id: "constituency-2010-to-2024",
				method: "official-lookup",
				quality: "publisher-supplied",
				weighting: { status: "not-provided" },
				provenance: {
					input: "lookup.geojson",
					inputHash: "sha256:input",
				},
				direction: "forward",
			},
			source: { code: "E14000001", labels: ["Old seat"] },
			targets: [{ code: "E14001001", labels: ["New seat A"] }],
		},
	]);

	const unsupported = route(
		"GET",
		"/v1/translations?sourceGeography=constituency&sourceRelease=2010&code=E14000001&targetGeography=constituency&targetRelease=2024-07-uk-bgc&purpose=membership",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(unsupported.status, 422);
});

test("reverses published identity and containment crosswalks", () => {
	const identity = route(
		"GET",
		"/v1/translations?sourceGeography=constituency&sourceRelease=2024-07-uk-bgc&code=E14001001&targetGeography=constituency&targetRelease=2010&purpose=identity",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(identity.status, 200);
	assert.deepEqual(
		"data" in identity.body &&
			(identity.body.data as { matches: unknown }).matches,
		[
			{
				crosswalk: {
					id: "constituency-2010-to-2024",
					method: "official-lookup",
					quality: "publisher-supplied",
					weighting: { status: "not-provided" },
					provenance: {
						input: "lookup.geojson",
						inputHash: "sha256:input",
					},
					direction: "reverse",
				},
				source: { code: "E14001001", labels: ["New seat A"] },
				targets: [{ code: "E14000001", labels: ["Old seat"] }],
			},
		],
	);

	const membership = route(
		"GET",
		"/v1/translations?sourceGeography=localAuthority&sourceRelease=2025-01-uk-lad&code=E08000001&targetGeography=ward&targetRelease=2025-01-en-ward&purpose=membership",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(membership.status, 200);
	assert.deepEqual(
		"data" in membership.body &&
			(membership.body.data as { matches: unknown }).matches,
		[
			{
				crosswalk: {
					id: "ward-to-local-authority-2025",
					method: "clean-containment",
					quality: "publisher-supplied",
					weighting: { status: "not-applicable" },
					provenance: {
						input: "lookup.geojson",
						inputHash: "sha256:input",
					},
					direction: "reverse",
				},
				source: { code: "E08000001", labels: ["Greater Manchester"] },
				targets: [{ code: "E05000001", labels: ["Example ward"] }],
			},
		],
	);
});

test("normalises reverse area-overlap weights against the queried target", () => {
	const overlap: CrosswalkArtifact = {
		schemaVersion: 1,
		contentHash: "sha256:overlap",
		id: "constituency-to-local-authority-overlap",
		method: "area-overlap",
		quality: "derived",
		weighting: {
			status: "provided",
			basis: "area",
			normalisation: "per-source",
		},
		from: { geography: "constituency", boundaryRelease: "2024" },
		to: { geography: "localAuthority", boundaryRelease: "2025" },
		provenance: {
			inputs: [],
			areaProjection: "EPSG:6933",
			clipping: "none",
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
				from: { status: "not-available", reason: "Fixture." },
				to: { status: "not-available", reason: "Fixture." },
			},
			overlap: {
				candidatePairCount: 2,
				intersectingPairCount: 2,
				sliverPairCount: 0,
				sliverWidthM: 100,
				widestSliverWidthM: null,
				narrowestOverlapWidthM: 200,
				minimumCoverage: 0.99,
				minimumSourceCoverage: 1,
				minimumTargetCoverage: 1,
			},
		},
		records: [
			{
				source: {
					code: "E14000001",
					labels: ["First seat"],
					areaM2: 400,
					coverage: 1,
				},
				targets: [
					{
						code: "E08000001",
						labels: ["Example authority"],
						weight: 1,
						overlapAreaM2: 400,
						sourceShare: 1,
						targetShare: 0.4,
					},
				],
			},
			{
				source: {
					code: "E14000002",
					labels: ["Second seat"],
					areaM2: 600,
					coverage: 1,
				},
				targets: [
					{
						code: "E08000001",
						labels: ["Example authority"],
						weight: 1,
						overlapAreaM2: 600,
						sourceShare: 1,
						targetShare: 0.6,
					},
				],
			},
		],
	};
	const response = route(
		"GET",
		"/v1/translations?sourceGeography=localAuthority&sourceRelease=2025&code=E08000001&targetGeography=constituency&targetRelease=2024&purpose=apportion",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		new Map([...crosswalkLookup, [overlap.id, overlap]]),
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual(
		(data as { matches: Array<{ sourceCoverage: number }> }).matches[0]
			.sourceCoverage,
		1,
	);
	assert.deepEqual(
		(data as { matches: Array<{ targets: unknown }> }).matches[0].targets,
		[
			{
				code: "E14000001",
				labels: ["First seat"],
				areaM2: 400,
				coverage: 1,
				weight: 0.4,
				overlapAreaM2: 400,
				sourceShare: 0.4,
				targetShare: 1,
			},
			{
				code: "E14000002",
				labels: ["Second seat"],
				areaM2: 600,
				coverage: 1,
				weight: 0.6,
				overlapAreaM2: 600,
				sourceShare: 0.6,
				targetShare: 1,
			},
		],
	);
});

test("publishes curated named locations and reports unresolved legacy members", () => {
	const list = routeWithNamedLocations("/v1/locations?q=greater");
	assert.equal(list.status, 200);
	assert.deepEqual("data" in list.body && list.body.data, [
		namedLocationInventory.locations[0],
	]);

	const members = routeWithNamedLocations(
		"/v1/locations/greater-manchester/members?release=2025-01-uk-lad",
	);
	assert.equal(members.status, 200);
	assert.deepEqual("data" in members.body && members.body.data, {
		location: namedLocationInventory.locations[0],
		geography: "localAuthority",
		boundaryRelease: "2025-01-uk-lad",
		membership: "direct-code-match",
		members: [
			{
				id: "localAuthority/2025-01-uk-lad/E08000001",
				code: "E08000001",
				name: "Greater Manchester",
				aliases: ["GM"],
			},
		],
		unresolvedMemberCodes: ["E08000000", "E08000998", "E08000999"],
		coverage: {
			memberCodeCount: 4,
			resolvedCount: 1,
			unresolvedCount: 3,
			complete: false,
			// Two of the three absences are the wrong vintage, which a location
			// spanning several of them always has. The third is in no release at
			// all, and that is what stops the location covering its ground.
			// Two absences are the wrong vintage and one is a legacy alias
			// naming no compiled area. None is an unexplained gap, so the
			// location still covers its ground.
			coversLocation: true,
			unexplained: [],
			legacy: [{ code: "E08000000", status: "unknown", presentIn: [] }],
			unresolved: [
				{ code: "E08000000", status: "unknown", presentIn: [] },
				{
					code: "E08000998",
					status: "not-yet-current",
					name: "Recoded authority",
					presentIn: ["2026-05-uk-lad"],
				},
				{
					code: "E08000999",
					status: "superseded",
					name: "Legacy authority",
					presentIn: ["2019-12-uk-lad"],
				},
			],
			note: "Coverage compares member codes against compiled area releases only. An unresolved code is not a claim that the place is missing, and a resolved one is not a claim of equal geometry. `complete` means every listed code resolved, which a location spanning several vintages never does; `coversLocation` is the one to read, and means every code that did not resolve was either the wrong vintage for this release or a legacy alias naming no compiled area, rather than an unexplained absence. Codes of the second kind are listed separately in `legacy`.",
		},
	});
});

test("lists published crosswalks", () => {
	const response = route(
		"GET",
		"/v1/crosswalks",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		crosswalkInventory.crosswalks,
	);
});

test("gets one crosswalk's metadata without its full record set", () => {
	const response = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && !("records" in (data as object)));
	assert.deepEqual(data, {
		schemaVersion: 1,
		contentHash: "sha256:crosswalk-artifact",
		id: "constituency-2010-to-2024",
		method: "official-lookup",
		quality: "publisher-supplied",
		weighting: { status: "not-provided" },
		from: { geography: "constituency", boundaryRelease: "2010" },
		to: { geography: "constituency", boundaryRelease: "2024-07-uk-bgc" },
		provenance: { input: "lookup.geojson", inputHash: "sha256:input" },
		validation: crosswalkArtifact.validation,
	});

	const missing = route(
		"GET",
		"/v1/crosswalks/unknown",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(missing.status, 404);
});

test("filters crosswalk records by source code", () => {
	const response = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024/records?source=E14000001",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		crosswalkArtifact.records,
	);

	const unfiltered = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024/records",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.deepEqual(
		"data" in unfiltered.body && unfiltered.body.data,
		crosswalkArtifact.records,
	);

	const noMatch = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024/records?source=unknown",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.deepEqual("data" in noMatch.body && noMatch.body.data, []);
});

const atlasRelease: AtlasRelease = {
	schemaVersion: 1,
	releaseId: "sha256:atlas-release",
	artifacts: [
		{
			id: "boundary-registry",
			path: "boundary-releases.json",
			contentHash: "sha256:registry",
		},
	],
};

test("gets the atlas release manifest", () => {
	const response = route(
		"GET",
		"/v1/atlas-release",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"atlasRelease" in response.body && response.body.atlasRelease,
		atlasRelease.releaseId,
	);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		atlasRelease,
	);
});

test("lists and compares archived Atlas releases by immutable artifact hash", () => {
	const previous: AtlasRelease = {
		schemaVersion: 1,
		releaseId: "sha256:previous-release",
		artifacts: [
			{
				id: "boundary-registry",
				path: "boundary-releases.json",
				contentHash: "sha256:previous-registry",
			},
		],
	};
	const context = {
		boundaryRegistry: registry,
		atlasRelease,
		atlasReleaseHistory: new Map([
			[previous.releaseId, previous],
			[atlasRelease.releaseId, atlasRelease],
		]),
	};
	const releases = routeRequest("GET", "/v1/atlas-releases", context);
	assert.equal(releases.status, 200);
	assert.equal(
		(("data" in releases.body ? releases.body.data : []) as unknown[])
			.length,
		2,
	);
	const comparison = routeRequest(
		"GET",
		`/v1/atlas-releases/compare?from=${previous.releaseId}`,
		context,
	);
	assert.equal(comparison.status, 200);
	assert.deepEqual(
		"data" in comparison.body &&
			(comparison.body.data as { summary: unknown }).summary,
		{ added: 0, removed: 0, changed: 1, unchanged: 0 },
	);
});

test("lists and downloads release-pinned whole observation artifacts", () => {
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === "small-area-fixture",
	);
	const source = measure?.sources[0];
	assert.ok(measure && source);
	const manifest = {
		schemaVersion: 1 as const,
		contentHash: "sha256:export-manifest",
		dataCatalogHash: dataCatalog.contentHash,
		exports: [
			{
				id: "small-area-fixture",
				measureId: measure.id,
				datasetId: source.datasetId,
				periods: source.periods,
				sourceGeography: source.sourceGeography,
				format: "json" as const,
				artifact: "small-area-fixture",
				contentHash: "sha256:small-area-observations",
				bytes: 123,
				href: "/v1/exports/small-area-fixture",
			},
		],
	};
	const listed = routeWithCatalog(
		"/v1/exports",
		dataCatalog,
		measureObservations,
		{ exportManifest: manifest },
	);
	assert.equal(listed.status, 200);
	const listedData =
		"data" in listed.body
			? (listed.body.data as {
					exports: typeof manifest.exports;
					note: string;
				})
			: undefined;
	assert.deepEqual(listedData?.exports, manifest.exports);
	assert.match(listedData?.note ?? "", /source-exact/);

	const downloaded = routeWithCatalog(
		"/v1/exports/small-area-fixture",
		dataCatalog,
		measureObservations,
		{ exportManifest: manifest },
	);
	assert.equal(downloaded.status, 200);
	assert.equal(downloaded.representation?.contentType, "application/json");
	assert.equal(
		downloaded.representation?.headers?.["content-disposition"],
		'attachment; filename="small-area-fixture.json"',
	);
	assert.deepEqual(
		JSON.parse(downloaded.representation?.body ?? "{}"),
		measureObservations[0],
	);
});

const relationshipCandidateInventory: RelationshipCandidateInventory = {
	schemaVersion: 1,
	contentHash: "sha256:relationship-candidates",
	candidates: [
		{
			id: "parish-2019-04-ew-bgc-to-local-authority-unavailable",
			input: "boundaries/parish/2019-04-ew-bgc/parishes.geojson",
			from: {
				geography: "parish",
				boundaryRelease: "2019-04-ew-bgc",
				codeProperty: "parncp19cd",
				nameProperty: "parncp19nm",
			},
			to: { codeProperty: "lad19cd", nameProperty: "lad19nm" },
			status: "not-available",
			validation: {
				endpoints: {
					from: {
						status: "verified",
						availableAreaCount: 11556,
						referencedCodeCount: 11556,
					},
					to: {
						status: "not-available",
						reason: "No compiled target release has lad19cd/lad19nm fields.",
					},
				},
				relationship: {
					sourceFeatureCount: 11556,
					sourceCodeCount: 11556,
					targetCodeCount: 339,
					multiTargetSourceCount: 0,
					missingValueFeatureCount: 0,
				},
				reasons: [
					"No compiled target release has lad19cd/lad19nm fields.",
				],
			},
		},
	],
};

test("lists discovered relationship candidates and their coverage gaps", () => {
	const response = route(
		"GET",
		"/v1/relationship-candidates",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		undefined,
		undefined,
		undefined,
		relationshipCandidateInventory,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		relationshipCandidateInventory.candidates,
	);
});

test("reports relationship candidates as unavailable before they are built", () => {
	const response = route(
		"GET",
		"/v1/relationship-candidates",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 503);
});

test("paginates crosswalk records with opaque cursors", () => {
	const pagedCrosswalk: CrosswalkArtifact = {
		...crosswalkArtifact,
		id: "paged-crosswalk",
		records: [
			...crosswalkArtifact.records,
			{
				source: { code: "E14000002", labels: ["Other old seat"] },
				targets: [{ code: "E14001002", labels: ["Other new seat"] }],
			},
		],
	};
	const pagedLookup: CrosswalkLookup = new Map([
		[pagedCrosswalk.id, pagedCrosswalk],
	]);
	const first = route(
		"GET",
		"/v1/crosswalks/paged-crosswalk/records?limit=1",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		pagedLookup,
	);
	assert.equal(first.status, 200);
	assert.deepEqual("data" in first.body && first.body.data, [
		pagedCrosswalk.records[0],
	]);
	const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
	assert.equal(typeof cursor, "string");
	assert.ok(cursor);

	const second = route(
		"GET",
		`/v1/crosswalks/paged-crosswalk/records?limit=1&cursor=${cursor}`,
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		pagedLookup,
	);
	assert.equal(second.status, 200);
	assert.deepEqual("data" in second.body && second.body.data, [
		pagedCrosswalk.records[1],
	]);
	assert.equal("meta" in second.body && second.body.meta.nextCursor, null);

	const invalid = route(
		"GET",
		"/v1/crosswalks/paged-crosswalk/records?limit=0",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		pagedLookup,
	);
	assert.equal(invalid.status, 400);
});

test("uses the immutable release id in every successful envelope", () => {
	const response = route(
		"GET",
		"/v1/geographies",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"atlasRelease" in response.body && response.body.atlasRelease,
		atlasRelease.releaseId,
	);
});

test("reports the atlas release as unavailable before it is built", () => {
	const response = route("GET", "/v1/atlas-release", registry);
	assert.equal(response.status, 503);
});

test("uses problem details for missing resources and unsupported methods", () => {
	const missing = route(
		"GET",
		"/v1/boundary-releases/ward/unknown",
		registry,
	);
	assert.equal(missing.status, 404);
	assert.equal("title" in missing.body && missing.body.title, "Not Found");

	const write = route("POST", "/v1/geographies", registry);
	assert.equal(write.status, 405);
	assert.equal(
		"title" in write.body && write.body.title,
		"Method Not Allowed",
	);
});

const validationReport: ValidationReport = {
	schemaVersion: 1,
	contentHash: "sha256:validation",
	inputs: { boundaryRegistry: "sha256:registry" },
	summary: {
		resourceCount: 2,
		checkCount: 2,
		passedCount: 1,
		waivedCount: 1,
		coverage: {
			boundaryReleases: 1,
			areaIdentities: 1,
			servableGeometry: 0,
			withRelationships: 1,
			crosswalks: 1,
			weightedCrosswalks: 0,
		},
	},
	resources: [
		{
			id: "boundary-releases/ward/2025-01-en-ward",
			kind: "boundary-release",
			status: "waived",
			checks: [
				{
					id: "geometry-servable",
					status: "waived",
					detail: "Geometry is EPSG:3857, and no transformation to WGS84 is available.",
					waiver: { reason: "No transformation yet." },
				},
			],
		},
		{
			id: "crosswalks/constituency-2010-to-2024-official-lookup-v2",
			kind: "crosswalk",
			status: "passed",
			checks: [{ id: "artifact-integrity", status: "passed" }],
		},
	],
};

const validationRoute = (url: string, report?: ValidationReport) =>
	route(
		"GET",
		url,
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
		undefined,
		undefined,
		undefined,
		relationshipCandidateInventory,
		report,
	);

test("serves the validation report, optionally only resources with waivers", () => {
	const all = validationRoute("/v1/validation", validationReport);
	assert.equal(all.status, 200);
	assert.deepEqual("data" in all.body && all.body.data, validationReport);
	const waived = validationRoute(
		"/v1/validation?status=waived",
		validationReport,
	);
	assert.deepEqual(
		"data" in waived.body &&
			(waived.body.data as ValidationReport).resources.map(
				(resource) => resource.id,
			),
		["boundary-releases/ward/2025-01-en-ward"],
	);
	assert.equal(
		validationRoute("/v1/validation?status=failed", validationReport)
			.status,
		400,
	);
});

test("serves one resource's validation at the resource's own path", () => {
	const release = validationRoute(
		"/v1/validation/boundary-releases/ward/2025-01-en-ward",
		validationReport,
	);
	assert.equal(release.status, 200);
	assert.deepEqual(
		"data" in release.body && release.body.data,
		validationReport.resources[0],
	);
	const crosswalk = validationRoute(
		"/v1/validation/crosswalks/constituency-2010-to-2024-official-lookup-v2",
		validationReport,
	);
	assert.equal(crosswalk.status, 200);
	assert.equal(
		validationRoute("/v1/validation/crosswalks/unknown", validationReport)
			.status,
		404,
	);
	assert.equal(
		validationRoute("/v1/validation/areas/ward", validationReport).status,
		404,
	);
});

test("reports validation as unavailable before the report is built", () => {
	assert.equal(validationRoute("/v1/validation").status, 503);
	assert.equal(
		validationRoute("/v1/validation/crosswalks/unknown").status,
		503,
	);
});

test("measures an area's geometry without returning its coordinates", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
							],
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const areaGeometryCache = new AreaGeometryCache(root, sources);

		const response = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry/metadata",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(response.status, 200);
		const data = ("data" in response.body && response.body.data) as Record<
			string,
			never
		>;
		// The point of the endpoint: measurements, and no coordinates beyond
		// the three single points that are themselves the answer.
		assert.equal("geometry" in data, false);
		assert.deepEqual(data.boundingBox, [-2, 54, -1, 55]);
		assert.equal(data.labelPointMethod, "centroid");
		assert.deepEqual(data.labelPoint, data.centroid);
		assert.deepEqual(data.geometryExtent, {
			parts: 1,
			rings: 1,
			vertices: 5,
		});

		const area = data.area as unknown as Record<string, number>;
		const perimeter = data.perimeter as unknown as Record<string, number>;
		// A degree of longitude at 54°N is about 65 km, a degree of latitude
		// about 111 km, so the cell is roughly 7,300 km².
		assert.ok(area.km2! > 7_200 && area.km2! < 7_400, `${area.km2} km2`);
		assert.equal(area.hectares, area.m2! / 10_000);
		assert.equal(area.km2, area.m2! / 1_000_000);
		assert.equal(perimeter.km, perimeter.m! / 1000);
		assert.match(
			(data.method as unknown as Record<string, string>).caveat!,
			/not a published land-area statistic/,
		);

		const unknownArea = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05099999/geometry/metadata",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			areaGeometryCache,
		);
		assert.equal(unknownArea.status, 404);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("refuses to measure geometry that carries no polygon", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Point",
							coordinates: [-2.24, 53.48],
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const response = route(
			"GET",
			"/v1/areas/ward/2025-01-en-ward/E05000001/geometry/metadata",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			new AreaGeometryCache(root, sources),
		);
		// A point source can still be served as geometry; it just cannot be
		// measured, and says so rather than reporting zero.
		assert.equal(response.status, 422);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("serves geometry at a named generalisation tier", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		// A square whose southern edge carries a run of small spikes.
		const south: number[][] = [];
		for (let i = 0; i <= 200; i += 1) {
			south.push([-2 + i / 200, 54 + (i % 2 === 0 ? 0 : 0.0005)]);
		}
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[...south, [-1, 55], [-2, 55], [-2, 54]],
							],
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const areaGeometryCache = new AreaGeometryCache(root, sources);
		const get = (query: string) =>
			route(
				"GET",
				`/v1/areas/ward/2025-01-en-ward/E05000001/geometry${query}`,
				registry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				undefined,
				undefined,
				undefined,
				areaGeometryCache,
			);

		const full = get("");
		const coarse = get("?tier=low");
		assert.equal(full.status, 200);
		assert.equal(coarse.status, 200);
		type Generalisation = {
			tier: string;
			toleranceM: number;
			vertices: number;
			verticesAtFullResolution: number;
			method?: Record<string, string>;
		};
		const properties = (response: typeof full) =>
			(
				("data" in response.body && response.body.data) as {
					properties: { generalisation: Generalisation };
				}
			).properties;
		const generalisation = properties(coarse).generalisation;
		assert.equal(generalisation.tier, "low");
		assert.equal(generalisation.toleranceM, 1000);
		assert.ok(
			generalisation.vertices < generalisation.verticesAtFullResolution,
			"coarse tier kept every vertex",
		);
		// The count reported is the count delivered, not merely a claim.
		const coarseGeometry = (
			("data" in coarse.body && coarse.body.data) as {
				geometry: { coordinates: number[][][] };
			}
		).geometry;
		assert.equal(
			coarseGeometry.coordinates.flat().length,
			generalisation.vertices,
		);
		// A generalised response carries the terms it was made on, and says so
		// about shared borders.
		assert.match(generalisation.method!.sharedBorders!, /shared border/);

		// The full tier is the default and explains nothing, having done nothing.
		assert.equal(properties(full).generalisation.tier, "full");
		assert.equal("method" in properties(full).generalisation, false);

		const unknownTier = get("?tier=coarse");
		assert.equal(unknownTier.status, 400);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("draws every child of an area as one FeatureCollection", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
							],
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const get = (query = "") =>
			route(
				"GET",
				`/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children/geometry${query}`,
				registry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				undefined,
				undefined,
				undefined,
				new AreaGeometryCache(root, sources),
			);

		const response = get();
		assert.equal(response.status, 200);
		const data = ("data" in response.body && response.body.data) as {
			type: string;
			parent: { code: string };
			collection: Record<string, never>;
			withoutGeometry: unknown[];
			features: {
				id: string;
				properties: Record<string, never>;
				geometry: { type: string };
			}[];
		};
		assert.equal(data.type, "FeatureCollection");
		assert.equal(data.parent.code, "E08000001");
		assert.equal(data.collection.members, 1);
		assert.equal(data.collection.withGeometry, 1);
		assert.equal(data.collection.tier, "full");
		assert.deepEqual(data.withoutGeometry, []);
		assert.equal(data.features.length, 1);

		const [child] = data.features;
		assert.equal(child!.id, "ward/2025-01-en-ward/E05000001");
		assert.equal(child!.geometry.type, "Polygon");
		// Membership is the crosswalk's published claim, carried with the
		// feature rather than implied by the collection it arrived in.
		assert.equal(
			(child!.properties.membership as unknown as { method: string })
				.method,
			"clean-containment",
		);

		// A coarser tier reports the method once for the collection, not on
		// every member.
		const coarse = get("?tier=low");
		const coarseData = ("data" in coarse.body && coarse.body.data) as {
			collection: Record<string, never>;
			features: { properties: Record<string, never> }[];
		};
		assert.equal(coarseData.collection.tier, "low");
		assert.ok("generalisationMethod" in coarseData.collection);
		assert.equal(
			"tier" in coarseData.features[0]!.properties.generalisation,
			false,
		);

		assert.equal(get("?tier=nope").status, 400);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("lists the children it could not draw rather than dropping them", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		// The source exists but holds no feature for the child's code.
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({ type: "FeatureCollection", features: [] }),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const response = route(
			"GET",
			"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children/geometry",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			undefined,
			undefined,
			undefined,
			new AreaGeometryCache(root, sources),
		);
		assert.equal(response.status, 200);
		const data = ("data" in response.body && response.body.data) as {
			collection: Record<string, never>;
			withoutGeometry: { code: string; reason: string }[];
			features: unknown[];
		};
		// A partial collection is still a 200, but it says what is missing and
		// why: members and withGeometry disagreeing is the signal.
		assert.equal(data.collection.members, 1);
		assert.equal(data.collection.withGeometry, 0);
		assert.equal(data.features.length, 0);
		assert.equal(data.withoutGeometry.length, 1);
		assert.equal(data.withoutGeometry[0]!.code, "E05000001");
		assert.match(
			data.withoutGeometry[0]!.reason,
			/No feature for this code/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("finds the areas meeting a box, and says how each meets it", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
							],
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const areaGeometryCache = new AreaGeometryCache(root, sources);
		const get = (query: string) =>
			route(
				"GET",
				`/v1/areas:intersects?${query}`,
				registry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				undefined,
				undefined,
				undefined,
				areaGeometryCache,
			);
		const where = "geography=ward&release=2025-01-en-ward";
		const data = (response: ReturnType<typeof get>) =>
			("data" in response.body && response.body.data) as {
				matched: number;
				returned: number;
				truncated: boolean;
				matches: {
					code: string;
					relation: string;
					boundingBox: number[];
					geometry?: unknown;
					generalisation?: { vertices: number };
				}[];
			} & Record<string, never>;

		// A box that swallows the ward whole.
		const enclosing = get(`bbox=-3,53,0,56&${where}`);
		assert.equal(enclosing.status, 200);
		assert.equal(data(enclosing).matched, 1);
		assert.equal(data(enclosing).matches[0]!.relation, "within");
		assert.deepEqual(
			data(enclosing).matches[0]!.boundingBox,
			[-2, 54, -1, 55],
		);

		// A box that cuts across it.
		const cutting = get(`bbox=-1.5,54.5,0,56&${where}`);
		assert.equal(data(cutting).matches[0]!.relation, "overlaps");

		// A box nowhere near it is an empty answer, not an error.
		const elsewhere = get(`bbox=10,10,11,11&${where}`);
		assert.equal(elsewhere.status, 200);
		assert.equal(data(elsewhere).matched, 0);
		assert.deepEqual(data(elsewhere).matches, []);

		// Identities by default: the coordinates cost extra, and are opted into.
		assert.equal("geometry" in data(enclosing).matches[0]!, false);
		const withGeometry = get(`bbox=-3,53,0,56&${where}&tier=low`);
		assert.ok(data(withGeometry).matches[0]!.geometry);
		assert.equal(data(withGeometry).tier, "low");
		assert.ok(data(withGeometry).matches[0]!.generalisation!.vertices > 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("bounds a box query by result count and rejects a malformed one", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[-2, 54],
									[-1, 54],
									[-1, 55],
									[-2, 55],
									[-2, 54],
								],
							],
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const get = (query: string) =>
			route(
				"GET",
				`/v1/areas:intersects?${query}`,
				registry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				undefined,
				undefined,
				undefined,
				new AreaGeometryCache(root, sources),
			);
		const where = "geography=ward&release=2025-01-en-ward";

		// One match, asked for none of it: still counted, and the cut is stated.
		const limited = get(`bbox=-3,53,0,56&${where}&limit=1`);
		const data = ("data" in limited.body && limited.body.data) as Record<
			string,
			never
		>;
		assert.equal(data.matched, 1);
		assert.equal(data.returned, 1);
		assert.equal(data.truncated, false);

		for (const query of [
			where, // no bbox at all
			`bbox=&${where}`,
			`bbox=1,2,3&${where}`, // three numbers
			`bbox=1,2,3,4,5&${where}`,
			`bbox=a,b,c,d&${where}`,
			`bbox=0,54,-1,55&${where}`, // west east of east
			`bbox=-2,55,-1,54&${where}`, // south north of north
			`bbox=-200,54,-1,55&${where}`, // off the globe
			`bbox=-2,54,-1,55&geography=ward`, // no release
			`bbox=-2,54,-1,55&${where}&limit=0`,
			`bbox=-2,54,-1,55&${where}&limit=1001`,
			`bbox=-2,54,-1,55&${where}&limit=1.5`,
			`bbox=-2,54,-1,55&${where}&tier=nope`,
		]) {
			assert.equal(get(query).status, 400, query);
		}

		// A release the catalogue does not carry is a 404, not a 400: the
		// request was well formed, there is just nothing to search.
		assert.equal(
			get(`bbox=-2,54,-1,55&geography=ward&release=1999-01-en-ward`)
				.status,
			404,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("lists an area's neighbours with the border each shares", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		const square = (
			west: number,
			south: number,
			east: number,
			north: number,
		) => [
			[
				[west, south],
				[east, south],
				[east, north],
				[west, north],
				[west, south],
			],
		];
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: square(-1, 54, 0, 55),
						},
					},
					// Shares the whole eastern edge.
					{
						properties: { WD25CD: "E05000002" },
						geometry: {
							type: "Polygon",
							coordinates: square(0, 54, 1, 55),
						},
					},
					// Meets at the single corner (0, 55) and nowhere else.
					{
						properties: { WD25CD: "E05000003" },
						geometry: {
							type: "Polygon",
							coordinates: square(0, 55, 1, 56),
						},
					},
					// Nowhere near any of them.
					{
						properties: { WD25CD: "E05000004" },
						geometry: {
							type: "Polygon",
							coordinates: square(20, 20, 21, 21),
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const areaGeometryCache = new AreaGeometryCache(root, sources);
		const get = (query = "") =>
			route(
				"GET",
				`/v1/areas/ward/2025-01-en-ward/E05000001/neighbours${query}`,
				registry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				undefined,
				undefined,
				undefined,
				areaGeometryCache,
			);
		const data = (response: ReturnType<typeof get>) =>
			("data" in response.body && response.body.data) as {
				touches: string;
				border: Record<string, number>;
				neighbours: {
					code: string;
					touch: string;
					sharedBorderM: number;
					shareOfPerimeter: number;
					sharedVertices: number;
				}[];
			} & Record<string, never>;

		// By default a corner is not a neighbour.
		const edges = get();
		assert.equal(edges.status, 200);
		assert.equal(data(edges).touches, "edge");
		assert.equal(data(edges).neighbours.length, 1);
		assert.equal(data(edges).neighbours[0]!.code, "E05000002");
		assert.equal(data(edges).neighbours[0]!.touch, "edge");
		// The corner touch is still counted, so a caller can see it was left out.
		assert.equal(data(edges).border.pointOnlyTouches, 1);

		// One side of four shared, but not a quarter of the perimeter: a cell a
		// degree square is a tall rectangle on the ground, 111 km north to
		// south against 65 km east to west, so the shared meridian is nearer a
		// third of the way round.
		const share = data(edges).neighbours[0]!.shareOfPerimeter;
		assert.ok(share > 0.3 && share < 0.33, `share ${share}`);
		assert.ok(
			data(edges).border.unsharedBorderM! >
				data(edges).border.sharedBorderM! * 2,
		);

		// Asking for point touches brings the corner in, with no border length.
		const any = get("?touches=any");
		assert.equal(data(any).neighbours.length, 2);
		const corner = data(any).neighbours.find(
			(neighbour) => neighbour.code === "E05000003",
		)!;
		assert.equal(corner.touch, "point");
		assert.equal(corner.sharedBorderM, 0);
		assert.equal(corner.sharedVertices, 1);
		// Ordered by how much border each shares, so the real one leads.
		assert.equal(data(any).neighbours[0]!.code, "E05000002");

		// The distant ward is in neither answer.
		assert.equal(
			data(any).neighbours.some(
				(neighbour) => neighbour.code === "E05000004",
			),
			false,
		);

		assert.equal(get("?touches=nope").status, 400);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("sums a location whose members span several code vintages", () => {
	// The shape every curated region has: an area that was one authority and
	// became another. The location lists both, and no release holds both, so
	// demanding that every listed code resolve refuses the location outright,
	// for every vintage there is.
	const locations = createNamedLocationLookup({
		schemaVersion: 1,
		contentHash: "sha256:vintage-locations",
		source: {
			artifact: "data/precompiled/gazetteer.core.json",
			gazetteerVersion: 1,
		},
		locations: [
			{
				id: "spanning",
				label: "Spanning",
				kind: "editorial-grouping",
				// E06000001 is current and carries the observation; E08000999
				// was superseded before this partition and E08000998 has yet
				// to take effect.
				memberCodes: ["E06000001", "E08000999", "E08000998"],
				bbox: [-2.5, 53.3, -2, 53.7],
			},
		],
	});
	const context: RouteContext = {
		boundaryRegistry: registry,
		// The lookup spanning three vintages, which is what lets a superseded
		// code be told from a wrong one.
		areaLookup: namedLocationAreaLookup,
		namedLocationLookup: locations,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	};
	const response = routeRequest(
		"GET",
		"/v1/data/population-estimate/aggregate?period=2022&geography=localAuthority&boundaryYear=2023&locationId=spanning",
		context,
	);
	assert.equal(
		response.status,
		200,
		JSON.stringify(response.body).slice(0, 400),
	);
	const data = response.body as {
		data: { aggregation: { inputRecordCount: number } };
	};
	// Only the code that exists in this partition is summed. The other two
	// contribute nothing and withhold nothing: a release's areas are a
	// partition, so the ground is covered exactly once.
	assert.equal(data.data.aggregation.inputRecordCount, 1);
});

test("resolves a named location into another geography through a crosswalk", () => {
	// The shared inventory lists only the constituency lookup; this test needs
	// the containment crosswalk advertised as well, since the route offers the
	// caller what the inventory publishes.
	const inventory: CrosswalkInventory = {
		...crosswalkInventory,
		crosswalks: [
			...crosswalkInventory.crosswalks,
			{
				id: containmentCrosswalk.id,
				from: containmentCrosswalk.from,
				to: containmentCrosswalk.to,
				method: containmentCrosswalk.method,
				quality: containmentCrosswalk.quality,
				weighting: containmentCrosswalk.weighting,
				recordCount: containmentCrosswalk.records.length,
				artifact: `crosswalks/${containmentCrosswalk.id}.json`,
				contentHash: containmentCrosswalk.contentHash,
			},
		],
	};
	const context: RouteContext = {
		boundaryRegistry: registry,
		areaLookup,
		crosswalkInventory: inventory,
		crosswalkLookup,
		namedLocationLookup,
	};
	const ask = (query: string) =>
		routeRequest(
			"GET",
			`/v1/locations/greater-manchester/members?${query}`,
			context,
		);

	// A location is curated as local authority codes, so asking for wards
	// without naming a crosswalk is answered with the ones to choose from
	// rather than an empty list or a silent choice.
	const unnamed = ask("geography=ward&release=2025-01-en-ward");
	assert.equal(unnamed.status, 400);
	assert.match(
		(unnamed.body as { detail: string }).detail,
		/ward-to-local-authority-2025/,
	);

	const resolved = ask(
		"geography=ward&release=2025-01-en-ward&via=ward-to-local-authority-2025",
	);
	assert.equal(
		resolved.status,
		200,
		JSON.stringify(resolved.body).slice(0, 300),
	);
	const data = ("data" in resolved.body && resolved.body.data) as {
		membership: string;
		membershipNote: string;
		partialMembers: number;
		parentGeography: string;
		parentBoundaryRelease: string;
		via: { id: string; method: string };
		members: {
			id: string;
			code: string;
			name: string;
			through: { code: string };
			weight?: number;
		}[];
	};
	assert.equal(data.membership, "fully-contained");
	assert.equal(data.via.id, "ward-to-local-authority-2025");
	assert.equal(data.via.method, "clean-containment");
	// The location's own codes are resolved against the release the crosswalk
	// ends at, not the ward release the caller asked for.
	assert.equal(data.parentGeography, "localAuthority");
	assert.equal(data.parentBoundaryRelease, "2025-01-uk-lad");
	assert.deepEqual(
		data.members.map((member) => member.code),
		["E05000001"],
	);
	// Each member names the authority it was found through, so the step is
	// visible rather than implied.
	assert.equal(data.members[0]!.through.code, "E08000001");
	assert.equal(data.members[0]!.name, "Example ward");
	// Containment reports no share: the ward is wholly inside.
	assert.equal(data.members[0]!.weight, undefined);
	assert.equal(data.partialMembers, 0);
	assert.match(data.membershipNote, /wholly inside/);

	// A crosswalk that does not start from the requested geography and release
	// is not silently substituted.
	assert.equal(
		ask(
			"geography=ward&release=2025-01-en-ward&via=constituency-2010-to-2024",
		).status,
		404,
	);
	assert.equal(
		ask(
			"geography=ward&release=1999-01-en-ward&via=ward-to-local-authority-2025",
		).status,
		404,
	);

	// The curated geography still resolves directly, with no crosswalk.
	const direct = ask("geography=localAuthority&release=2025-01-uk-lad");
	assert.equal(direct.status, 200);
	assert.equal(
		("data" in direct.body && direct.body.data) !== undefined &&
			(direct.body as { data: { membership: string } }).data.membership,
		"direct-code-match",
	);
});

test("ranks change between two periods of one source partition", () => {
	const context: RouteContext = {
		boundaryRegistry: registry,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	};
	const ask = (measureId: string, query: string) =>
		routeRequest("GET", `/v1/data/${measureId}/change?${query}`, context);
	const partition = "geography=localAuthority&boundaryYear=2023";
	type Record = {
		areaCode: string;
		rank: number;
		tieCount: number;
		start: { period: string; value: number };
		end: { period: string; value: number };
		absoluteChange: number;
		relativeChange: number | null;
	};
	const data = (response: ReturnType<typeof ask>) =>
		(
			response.body as {
				data: {
					change: { direction: string; basis: string; unit: string };
					coverage: { areasRanked: number; onlyAtStart: string[] };
					records: Record[];
				};
			}
		).data;

	// Both authorities grow by 20 people between 2022 and 2024, so absolute
	// change ties them at rank 1, and the next rank would account for both.
	const absolute = ask(
		"population-estimate",
		`${partition}&startPeriod=2022&endPeriod=2024`,
	);
	assert.equal(
		absolute.status,
		200,
		JSON.stringify(absolute.body).slice(0, 300),
	);
	assert.equal(data(absolute).change.direction, "end-minus-start");
	assert.equal(data(absolute).change.unit, "people");
	assert.deepEqual(
		data(absolute).records.map((record) => [record.rank, record.tieCount]),
		[
			[1, 2],
			[1, 2],
		],
	);
	const first = data(absolute).records.find(
		(record) => record.areaCode === "E06000001",
	)!;
	assert.deepEqual(first.start, {
		period: "2022",
		areaCode: "E06000001",
		value: 280,
		status: "observed",
	});
	assert.equal(first.end.value, 300);
	assert.equal(first.absoluteChange, 20);

	// Relative change separates them: 20 on 280 is more than 20 on 380.
	const relative = ask(
		"population-estimate",
		`${partition}&startPeriod=2022&endPeriod=2024&by=relative`,
	);
	assert.equal(data(relative).change.unit, "proportion");
	assert.deepEqual(
		data(relative).records.map((record) => record.areaCode),
		["E06000001", "N09000001"],
	);
	assert.ok(
		Math.abs(data(relative).records[0]!.relativeChange! - 20 / 280) < 1e-12,
	);

	// One area, keeping its place among all of them.
	const one = ask(
		"population-estimate",
		`${partition}&startPeriod=2022&endPeriod=2024&by=relative&areaCode=N09000001`,
	);
	assert.equal(data(one).records.length, 1);
	assert.equal(data(one).records[0]!.rank, 2);
	assert.equal(data(one).coverage.areasRanked, 2);

	// Refusals, each saying how to recover.
	const refusals: [string, string, number, RegExp][] = [
		// The partition's periods are listed, not guessed at.
		[
			"population-estimate",
			`${partition}&startPeriod=2019&endPeriod=2024`,
			400,
			/2022, 2023, 2024/,
		],
		[
			"population-estimate",
			`${partition}&startPeriod=2024&endPeriod=2022`,
			400,
			/before/,
		],
		// Naming no partition lists the partitions that exist.
		[
			"population-estimate",
			"startPeriod=2022&endPeriod=2024",
			400,
			/boundaryYear=2023 \(3 periods\)/,
		],
		// A partition of one period has nothing to change between.
		[
			"ghg-emissions",
			"geography=localAuthority&boundaryYear=2025&startPeriod=2024&endPeriod=2024",
			422,
			/single period/,
		],
		// A single-period partition is refused before the basis is looked at,
		// so a ratio asked for relatively is told there is nothing to change
		// between. The ratio rule itself is covered where it is decided.
		[
			"mobile-5g-coverage",
			"geography=localAuthority&boundaryYear=2024&startPeriod=2025&endPeriod=2025&by=relative",
			422,
			/single period/,
		],
		[
			"population-estimate",
			`${partition}&startPeriod=2022&endPeriod=2024&release=2023-05-uk-bgc-v2`,
			422,
			/one source partition/,
		],
		[
			"population-estimate",
			`${partition}&startPeriod=2022&endPeriod=2024&areaCode=E99999999`,
			404,
			/not in this partition/,
		],
	];
	for (const [measureId, query, status, detail] of refusals) {
		const response = ask(measureId, query);
		assert.equal(response.status, status, `${measureId}?${query}`);
		assert.match((response.body as { detail: string }).detail, detail);
	}
});

test("answers a measure for a place named in words", () => {
	// Names for the two authorities the population fixture carries values for.
	const namedAreas = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:named-areas",
			geography: "localAuthority",
			boundaryRelease: "2023-05-uk-bgc-v2",
			codeProperty: "LAD23CD",
			nameProperty: "LAD23NM",
			areas: [
				{ code: "E06000001", name: "Hartlepool" },
				{ code: "N09000001", name: "Antrim and Newtownabbey" },
			],
		},
	]);
	const context: RouteContext = {
		boundaryRegistry: registry,
		areaLookup: namedAreas,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	};
	const get = (url: string) => routeRequest("GET", url, context);

	const places = get("/v1/places?q=antrim%20%26%20newtownabbey");
	assert.equal(places.status, 200);
	const candidates = (
		places.body as { data: { candidates: { place: string }[] } }
	).data.candidates;
	assert.deepEqual(
		candidates.map((candidate) => candidate.place),
		["localAuthority/N09000001"],
	);

	const answered = get("/v1/data/population-estimate/value?place=Hartlepool");
	assert.equal(
		answered.status,
		200,
		JSON.stringify(answered.body).slice(0, 300),
	);
	const data = (
		answered.body as {
			data: {
				answer: {
					value: number;
					unit: string;
					period: string;
					periodDefaulted: boolean;
				};
				place: { place: string };
				method: string;
				via: string;
				note: string;
			};
		}
	).data;
	// No period asked for, so the latest the partition publishes.
	assert.deepEqual(
		[data.answer.value, data.answer.unit, data.answer.period],
		[300, "people", "2024"],
	);
	assert.equal(data.answer.periodDefaulted, true);
	assert.match(data.note, /latest published, 2024/);
	assert.equal(data.place.place, "localAuthority/E06000001");
	assert.equal(data.method, "source-exact");
	// The route that gives the answer directly is named, and gives the same one.
	const direct = get(data.via);
	assert.equal(direct.status, 200);

	const earlier = get(
		"/v1/data/population-estimate/value?place=Hartlepool&period=2022",
	);
	assert.equal(
		(earlier.body as { data: { answer: { value: number } } }).data.answer
			.value,
		280,
	);

	assert.equal(
		get("/v1/data/population-estimate/value?place=Atlantis").status,
		404,
	);
	assert.equal(get("/v1/data/population-estimate/value").status, 400);
	assert.equal(
		get("/v1/data/no-such-measure/value?place=Hartlepool").status,
		404,
	);
	assert.equal(get("/v1/places").status, 400);
});

const citationRegistry: BoundaryRegistry = {
	...registry,
	releases: [
		...registry.releases,
		{
			id: "2023-05-uk-bgc",
			geography: "ward",
			title: "Wards, May 2023",
			coverage: { countries: ["GB-ENG", "GB-WLS"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/wards-2023",
				retrievedAt: "2026-01-01",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: "sha256:wards-2023-metadata",
		},
		{
			id: "2025-01-uk-lad",
			geography: "localAuthority",
			title: "Local authorities",
			coverage: { countries: ["GB-ENG"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/lad",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: "sha256:lad-metadata",
		},
		// The endpoints of the constituency crosswalk, which maps no ward.
		...["2010", "2024-07-uk-bgc"].map((id) => ({
			id,
			geography: "constituency",
			title: `Constituencies ${id}`,
			coverage: { countries: ["GB-ENG"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/constituencies",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: `sha256:constituency-${id}-metadata`,
		})),
	],
};

const citationContext = {
	boundaryRegistry: citationRegistry,
	areaInventory: {
		schemaVersion: 1,
		contentHash: "sha256:area-inventory",
		boundaryRegistryHash: "sha256:registry",
		releases: [
			{
				id: "2025-01-en-ward",
				geography: "ward",
				status: "available",
				recordCount: 2,
				artifact: "areas/ward/2025-01-en-ward.json",
				contentHash: "sha256:areas",
				codeProperty: "WD25CD",
				nameProperty: "WD25NM",
			},
		],
	},
	areaLookup: new Map([...areaLookup, ...compatibleWardAreaLookup]),
	crosswalkInventory: {
		...crosswalkInventory,
		crosswalks: [
			...crosswalkInventory.crosswalks,
			{
				id: containmentCrosswalk.id,
				from: containmentCrosswalk.from,
				to: containmentCrosswalk.to,
				method: containmentCrosswalk.method,
				quality: containmentCrosswalk.quality,
				weighting: containmentCrosswalk.weighting,
				recordCount: containmentCrosswalk.records.length,
				artifact: `crosswalks/${containmentCrosswalk.id}.json`,
				contentHash: containmentCrosswalk.contentHash,
			},
		],
	},
	crosswalkLookup,
	atlasRelease,
	validationReport,
	dataCatalog: {
		...dataCatalog,
		datasets: [
			...dataCatalog.datasets,
			{
				...dataCatalog.datasets[0]!,
				id: "population-uk",
				label: "Population (UK)",
			},
		],
	},
	populationObservations,
	populationLocalAuthorityObservations,
	measureObservations,
	measureCompatibilityInventory,
} satisfies RouteContext;

const citation = (url: string, context: RouteContext = citationContext) => {
	const response = routeRequest("GET", url, context);
	return {
		status: response.status,
		data: ("data" in response.body ? response.body.data : undefined) as
			Record<string, unknown> | undefined,
		detail: "detail" in response.body ? response.body.detail : undefined,
	};
};

test("cites an area with its release, identity hash, validation and attribution", () => {
	const { status, data } = citation(
		"/v1/areas/ward/2025-01-en-ward/E05000001/citation?crosswalk=ward-to-local-authority-2025",
	);
	assert.equal(status, 200);
	assert.ok(data);
	assert.deepEqual(data.atlasRelease, {
		id: "sha256:atlas-release",
		href: "/v1/atlas-releases/sha256:atlas-release",
	});
	assert.deepEqual(data.identity, {
		status: "available",
		artifact: "areas/ward/2025-01-en-ward.json",
		contentHash: "sha256:areas",
	});
	assert.deepEqual(data.boundary, {
		id: "ward/2025-01-en-ward",
		title: "Ward boundaries",
		publisher: "ONS",
		sourceUrl: "https://example.com/source",
		licence: { name: "Open Government Licence" },
		metadataHash: "sha256:metadata",
		href: "/v1/boundary-releases/ward/2025-01-en-ward",
	});
	assert.equal(
		(data.geometry as { hash: { status: string } }).hash.status,
		"not-published",
	);
	assert.deepEqual(data.crosswalks, [
		{
			id: "ward-to-local-authority-2025",
			method: "clean-containment",
			quality: "publisher-supplied",
			from: { geography: "ward", boundaryRelease: "2025-01-en-ward" },
			to: {
				geography: "localAuthority",
				boundaryRelease: "2025-01-uk-lad",
			},
			contentHash: "sha256:containment-artifact",
			provenance: { input: "lookup.geojson", inputHash: "sha256:input" },
			href: "/v1/crosswalks/ward-to-local-authority-2025",
		},
	]);
	assert.deepEqual(data.validation, {
		status: "available",
		reportHash: "sha256:validation",
		resources: [
			{ id: "atlas", status: "not-validated" },
			{
				...validationReport.resources[0],
				href: "/v1/validation/boundary-releases/ward/2025-01-en-ward",
			},
			{
				id: "crosswalks/ward-to-local-authority-2025",
				status: "not-validated",
			},
		],
	});
	assert.deepEqual(
		(data.resources as Array<{ id: string }>).map(
			(resource) => resource.id,
		),
		[
			"ward/2025-01-en-ward",
			"localAuthority/2025-01-uk-lad",
			"ward-to-local-authority-2025",
		],
	);
	assert.match(
		data.text as string,
		/Compiled by the UK Data Atlas, release sha256:atlas-release\.$/,
	);
});

test("cites a measure through the observations holding the area's value", () => {
	const { status, data } = citation(
		"/v1/areas/ward/2023-05-uk-bgc/E05000001/citation?measure=population-estimate",
	);
	assert.equal(status, 200);
	assert.ok(data);
	assert.deepEqual(data.identity, { status: "not-published" });
	assert.deepEqual(data.measures, [
		{
			id: "population-estimate",
			label: "Population estimate",
			href: "/v1/measures/population-estimate",
			sources: [
				{
					dataset: {
						id: "population",
						href: "/v1/datasets/population",
					},
					sourceGeography: { type: "ward", boundaryYear: 2023 },
					codeSetCompatibility: {
						status: "code-set-compatible",
						eligibleForCodeJoin: true,
					},
					periods: [
						{
							period: "2022",
							artifact: "population-observations",
							contentHash: "sha256:population-observations",
							status: "observed",
						},
					],
				},
			],
		},
	]);
	// The measure's local-authority partition holds nothing for a ward, so
	// its dataset is not credited.
	assert.deepEqual(
		(data.resources as Array<{ id: string }>).map(
			(resource) => resource.id,
		),
		["population", "ward/2023-05-uk-bgc"],
	);
});

test("refuses to cite a resource that supplies nothing for the area", () => {
	const unrelatedCrosswalk = citation(
		"/v1/areas/ward/2025-01-en-ward/E05000001/citation?crosswalk=constituency-2010-to-2024",
	);
	assert.equal(unrelatedCrosswalk.status, 422);
	assert.equal(
		unrelatedCrosswalk.detail,
		"crosswalk=constituency-2010-to-2024 publishes no relationship for ward/2025-01-en-ward/E05000001.",
	);
	const unassessedMeasure = citation(
		"/v1/areas/ward/2025-01-en-ward/E05000001/citation?measure=population-estimate",
	);
	assert.equal(unassessedMeasure.status, 422);
	assert.equal(
		unassessedMeasure.detail,
		"measure=population-estimate publishes no observation for ward/2025-01-en-ward/E05000001 in a source assessed against this boundary release.",
	);
	assert.equal(
		citation(
			"/v1/areas/ward/2025-01-en-ward/E05000001/citation?measure=unknown",
		).status,
		404,
	);
	assert.equal(
		citation("/v1/areas/ward/2025-01-en-ward/E05999999/citation").status,
		404,
	);
	assert.equal(
		citation("/v1/areas/ward/2025-01-en-ward/E05000001/citation", {
			...citationContext,
			dataCatalog: undefined,
		}).status,
		503,
	);
});

test("explains why an area identity resolves to nothing", () => {
	const unknownCode = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05999999/relationships",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(unknownCode.status, 404);
	assert.deepEqual(unknownCode.body, {
		type: "https://api.ukdataatlas.com/problems/not-found",
		title: "Not Found",
		status: 404,
		detail: "E05999999 is held by no compiled release of this geography.",
		code: "area_not_in_release",
		absence: "unknown",
		presentIn: [],
	});
	const unknownRelease = route(
		"GET",
		"/v1/areas/ward/2019-12-en-ward/E05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(unknownRelease.status, 404);
	assert.deepEqual(unknownRelease.body, {
		type: "https://api.ukdataatlas.com/problems/not-found",
		title: "Not Found",
		status: 404,
		detail: "No ward boundary release is published as 2019-12-en-ward.",
		code: "unsupported_geography",
		absence: "unknown-release",
		availableReleases: [
			{
				id: "2025-01-en-ward",
				href: "/v1/boundary-releases/ward/2025-01-en-ward",
			},
		],
	});
});

test("flags a country total that leaves out areas a matching release holds", () => {
	const url =
		"/v1/data/ghg-emissions/aggregate?period=2024&geography=localAuthority&boundaryYear=2025&areaCode=E92000001";
	const context = {
		boundaryRegistry: registry,
		areaLookup: createAreaLookup([
			{
				schemaVersion: 1,
				contentHash: "sha256:fixture-lad",
				geography: "localAuthority",
				boundaryRelease: "2025-12-uk-lad",
				codeProperty: "LAD25CD",
				nameProperty: "LAD25NM",
				areas: [
					{ code: "E06000001", name: "Published" },
					{ code: "E06000002", name: "Unpublished" },
					{ code: "S12000001", name: "Another country" },
				],
			},
		]),
		dataCatalog,
		measureObservations,
		measureCompatibilityInventory: {
			...measureCompatibilityInventory,
			measures: [
				{
					measureId: "ghg-emissions",
					sources: [
						{
							datasetId: "ghg-emissions",
							sourceGeography: {
								type: "localAuthority",
								boundaryYear: 2025,
							},
							periods: ["2024"],
							candidates: [
								{
									boundaryRelease: "2025-12-uk-lad",
									title: "Fixture local authorities",
									coverageCountries: ["GB-ENG", "GB-SCT"],
									status: "code-set-compatible",
									sourceCodeCount: 1,
									candidateCodeCount: 3,
									matchingCodeCount: 1,
									matchedSourceShare: 1,
									unmatchedSourceCodeCount: 0,
									unmatchedSourceCodeSample: [],
									candidateOnlyCodeCount: 2,
									candidateOnlyCodeSample: [
										"E06000002",
										"S12000001",
									],
								},
							],
							note: "Fixture compatibility.",
						},
					],
				},
			],
		},
	} satisfies RouteContext;
	const coverageOf = (response: ReturnType<typeof routeRequest>) => {
		assert.equal(response.status, 200);
		return (
			response.body as {
				data: { aggregation: { coverage: Record<string, unknown> } };
			}
		).data.aggregation.coverage;
	};

	const partial = coverageOf(routeRequest("GET", url, context));
	assert.equal(partial.status, "partial");
	assert.equal(partial.code, "partial_coverage");
	assert.deepEqual(partial.assessments, [
		{
			boundaryRelease: "2025-12-uk-lad",
			status: "partial",
			expectedAreaCount: 2,
			includedAreaCount: 1,
			missingAreaCount: 1,
			missingAreaSample: ["E06000002"],
		},
	]);

	// Without a matching release, the areas a country should hold are unknown,
	// and the total says so rather than passing for complete.
	const unassessed = coverageOf(
		routeRequest("GET", url, {
			...context,
			measureCompatibilityInventory: undefined,
		}),
	);
	assert.equal(unassessed.status, "not-assessed");
});
