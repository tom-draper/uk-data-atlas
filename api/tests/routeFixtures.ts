import { createAreaLookup } from "../src/areaInventory";
import type { AreaGeometryCache } from "../src/areaGeometry";
import {
	createGeographyResolver,
	type GeographyResolverInputs,
} from "../src/geographyResolver";
import { route as routeRequest } from "../src/routes";
import type { CrosswalkLookup, RouteContext } from "../src/routing";
import type { AtlasRelease } from "../src/atlasRelease";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import type {
	CrosswalkInventory,
	PropertyCrosswalkArtifact,
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
import { createRelationshipPathIndex } from "../src/relationshipPaths";

/**
 * What a test context is built from: route resources, plus the raw lookups
 * the geography resolver indexes. Routes only ever see the resolver.
 */
export type TestContextInputs = Partial<RouteContext> & {
	areaLookup?: GeographyResolverInputs["areaLookup"];
	crosswalkLookup?: GeographyResolverInputs["crosswalkLookup"];
	namedLocationLookup?: GeographyResolverInputs["namedLocationLookup"];
	areaGeometryCache?: GeographyResolverInputs["areaGeometryCache"];
};

const resolverFor = (inputs: TestContextInputs) =>
	createGeographyResolver({
		boundaryRegistry: inputs.boundaryRegistry,
		geographyInventory: inputs.geographyInventory,
		areaInventory: inputs.areaInventory,
		areaLookup: inputs.areaLookup,
		crosswalkInventory: inputs.crosswalkInventory,
		crosswalkLookup: inputs.crosswalkLookup,
		areaGeometryCache: inputs.areaGeometryCache,
		namedLocationInventory: inputs.namedLocationInventory,
		namedLocationLookup: inputs.namedLocationLookup,
		locationProjectionStore: inputs.locationProjectionStore,
		relationshipPathIndex: inputs.relationshipPathInventory
			? createRelationshipPathIndex(inputs.relationshipPathInventory)
			: undefined,
		relationshipCandidateInventory: inputs.relationshipCandidateInventory,
	});

// Most tests exercise one narrow dependency combination. This fixture adapter
// keeps those cases concise while ensuring the production router only accepts
// its named RouteContext.
export const route = (
	method: string | undefined,
	url: string | undefined,
	boundaryRegistry: BoundaryRegistry,
	geographyInventory?: RouteContext["geographyInventory"],
	areaLookup?: TestContextInputs["areaLookup"],
	crosswalkInventory?: RouteContext["crosswalkInventory"],
	crosswalkLookup?: TestContextInputs["crosswalkLookup"],
	atlasRelease?: RouteContext["atlasRelease"],
	areaGeometryCache?: AreaGeometryCache,
	relationshipCandidateInventory?: RouteContext["relationshipCandidateInventory"],
	validationReport?: RouteContext["validationReport"],
	namedLocationInventory?: RouteContext["namedLocationInventory"],
	namedLocationLookup?: TestContextInputs["namedLocationLookup"],
	dataCatalog?: RouteContext["dataCatalog"],
	populationObservations?: RouteContext["populationObservations"],
	populationLocalAuthorityObservations?: RouteContext["populationLocalAuthorityObservations"],
	measureCompatibilityInventory?: RouteContext["measureCompatibilityInventory"],
	measureObservations?: RouteContext["measureObservations"],
	exportManifest?: RouteContext["exportManifest"],
	relationshipPathInventory?: RouteContext["relationshipPathInventory"],
) =>
	routeRequest(
		method,
		url,
		testContext({
			boundaryRegistry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
			atlasRelease,
			areaGeometryCache,
			relationshipCandidateInventory,
			validationReport,
			namedLocationInventory,
			namedLocationLookup,
			relationshipPathInventory,
			dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
			measureCompatibilityInventory,
			measureObservations,
			exportManifest,
		}),
	);

export const registry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [
		{
			id: "2025-01-en-ward",
			geography: "ward",
			title: "Ward boundaries",
			temporalCoverage: "2023",
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

/**
 * A route context whose resolver indexes the given inputs. The raw lookups
 * go only to the resolver, as they do in the catalogue loader.
 */
export const testContext = (
	inputs: TestContextInputs = {},
	areaGeometryCache?: AreaGeometryCache,
): RouteContext => {
	const {
		areaLookup: _areaLookup,
		crosswalkLookup: _crosswalkLookup,
		namedLocationLookup: _namedLocationLookup,
		areaGeometryCache: _areaGeometryCache,
		...resources
	} = inputs;
	const withRegistry = { boundaryRegistry: registry, ...inputs };
	return {
		...resources,
		boundaryRegistry: withRegistry.boundaryRegistry,
		geographyResolver:
			inputs.geographyResolver ??
			resolverFor({
				...withRegistry,
				areaGeometryCache: inputs.areaGeometryCache ?? areaGeometryCache,
			}),
	};
};

export const geographyInventory: GeographyInventory = {
	schemaVersion: 1,
	contentHash: "sha256:geography",
	boundaryRegistryHash: "sha256:registry",
	releases: [],
	geographies: [],
};

export const areaLookup = createAreaLookup([
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

export const compatibleWardAreaLookup = createAreaLookup([
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
export const namedLocationAreaLookup = createAreaLookup([
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

export const crosswalkArtifact: PropertyCrosswalkArtifact = {
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

export const crosswalkInventory: CrosswalkInventory = {
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

export const containmentCrosswalk: PropertyCrosswalkArtifact = {
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

export const crosswalkLookup: CrosswalkLookup = new Map([
	[crosswalkArtifact.id, crosswalkArtifact],
	[containmentCrosswalk.id, containmentCrosswalk],
]);

export const namedLocationInventory: NamedLocationInventory = {
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
			definitionRevision: 1,
			memberGeography: "localAuthority",
			memberCodes: ["E08000000", "E08000001", "E08000998", "E08000999"],
			validity: { from: null, to: null },
			bbox: [-2.5, 53.3, -2, 53.7],
		},
	],
};

export const namedLocationLookup = createNamedLocationLookup(
	namedLocationInventory,
);

export const dataCatalog: DataCatalog = {
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

export const measureObservations: MeasureObservationArtifact[] = [
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

export const populationObservations: PopulationObservationArtifact = {
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

export const populationLocalAuthorityObservations: PopulationLocalAuthorityObservationArtifact =
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

export const measureCompatibilityInventory: MeasureCompatibilityInventory = {
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

export const routeWithData = (url: string) =>
	routeWithCatalog(url, dataCatalog, measureObservations);

export const routeWithCatalog = (
	url: string,
	catalog: DataCatalog,
	observations: RouteContext["measureObservations"],
	overrides: Pick<
		TestContextInputs,
		| "crosswalkLookup"
		| "measureCompatibilityInventory"
		| "analysisGeographyInventory"
		| "exportManifest"
		| "relationshipPathInventory"
	> = {},
) =>
	routeRequest(
		"GET",
		url,
		testContext({
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup: overrides.crosswalkLookup ?? crosswalkLookup,
			dataCatalog: catalog,
			populationObservations,
			populationLocalAuthorityObservations,
		measureCompatibilityInventory:
			overrides.measureCompatibilityInventory ??
			measureCompatibilityInventory,
		analysisGeographyInventory: overrides.analysisGeographyInventory,
		measureObservations: observations,
			exportManifest: overrides.exportManifest,
			relationshipPathInventory: overrides.relationshipPathInventory,
		}),
	);

export const atlasRelease: AtlasRelease = {
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

export const relationshipCandidateInventory: RelationshipCandidateInventory = {
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

export const validationReport: ValidationReport = {
	schemaVersion: 1,
	contentHash: "sha256:validation",
	inputs: { boundaryRegistry: "sha256:registry" },
	summary: {
		resourceCount: 4,
		checkCount: 4,
		passedCount: 3,
		waivedCount: 1,
		coverage: {
			boundaryReleases: 1,
			areaIdentities: 1,
			servableGeometry: 0,
			withRelationships: 1,
			crosswalks: 1,
			weightedCrosswalks: 0,
			measures: 1,
			measureSources: 1,
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
		{
			id: "measures/crime-total",
			kind: "measure",
			status: "passed",
			checks: [{ id: "measure-definition", status: "passed" }],
		},
		{
			id: "exports/crime-total-observations",
			kind: "measure-source",
			status: "passed",
			checks: [
				{
					id: "components-sum-to-total",
					status: "passed",
					measured: { comparedCount: 314, mismatchCount: 0 },
				},
			],
		},
	],
};
