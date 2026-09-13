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
	MeasureObservationArtifact,
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
	],
};

const measureObservations: MeasureObservationArtifact[] = [
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
	route(
		"GET",
		url,
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureCompatibilityInventory,
		measureObservations,
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
		'atlasRelease,measureId,unit,datasetId,period,geography,boundaryYear,boundaryRelease,geometryCompatibility,transformationStatus,areaCode,areaId,areaName,areaAliases,value,status\n"sha256:registry","population-estimate","people","population","2022","ward","2023","","","not-applied","E05000001","","","","100","observed"\n',
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

	// A share cannot be regrouped by adding it up.
	const intensive = routeWithData(
		`/v1/data/mobile-5g-coverage/convert?period=2025&geography=localAuthority&boundaryYear=2024&crosswalk=${crosswalkArtifact.id}`,
	);
	assert.equal(intensive.status, 422);
	assert.match(
		"detail" in intensive.body ? intensive.body.detail : "",
		/Only an extensive measure can be converted/,
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
			note: "Every curated location member code was found in the published source partition.",
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

	const incomplete = routeRequest(
		"GET",
		"/v1/data/population-estimate/aggregate?period=2022&geography=ward&boundaryYear=2023&locationId=incomplete-test-wards",
		context,
	);
	assert.equal(incomplete.status, 422);

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
			note: "Coverage compares member codes against compiled area releases only. An unresolved code is not a claim that the place is missing, and a resolved one is not a claim of equal geometry.",
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
