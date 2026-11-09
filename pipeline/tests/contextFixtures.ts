import type { AreaGeometryCache } from "@uk-data-atlas/geometry";
import { createAreaLookup } from "@uk-data-atlas/areas";
import {
	createGeographyResolver,
	createGeographyServices,
	type GeographyResolverInputs,
} from "@uk-data-atlas/atlas-runtime/loader";
import type { RouteContext } from "@uk-data-atlas/atlas-runtime/api";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
	PropertyCrosswalkArtifact,
} from "@uk-data-atlas/relationships";
import type {
	DataCatalog,
	MeasureCompatibilityInventory,
	MeasureObservationArtifact,
} from "@uk-data-atlas/catalogue/node";
import { compileAreaSearchIndex } from "@uk-data-atlas/areas";
import { compilePlaceIndex } from "@uk-data-atlas/places";
import { createRelationshipPathIndex } from "@uk-data-atlas/relationships";

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

const resolverFor = (inputs: TestContextInputs) => {
	const geographyInputs = {
		boundaryRegistry: inputs.boundaryRegistry,
		geographyInventory: inputs.geographyInventory,
		areaInventory: inputs.areaInventory,
		areaLookup: inputs.areaLookup,
		// Compiled from the fixture areas as the build compiles it from the
		// area inventory.
		placeIndex: inputs.areaLookup
			? compilePlaceIndex(
					inputs.areaLookup,
					inputs.namedLocationInventory,
					inputs.areaInventory?.contentHash ?? "sha256:fixture-areas",
					inputs.boundaryRegistry,
				)
			: undefined,
		areaSearchIndex: inputs.areaLookup
			? compileAreaSearchIndex(
					inputs.areaLookup,
					inputs.areaInventory?.contentHash ?? "sha256:fixture-areas",
				)
			: undefined,
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
	};
	const services = createGeographyServices(geographyInputs);
	return {
		resolver: createGeographyResolver(geographyInputs, services),
		validation: services.validation,
		postcodes: services.postcodes,
	};
};

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
	const built = resolverFor({
		...withRegistry,
		areaGeometryCache: inputs.areaGeometryCache ?? areaGeometryCache,
	});
	return {
		...resources,
		areaGeometryCache: inputs.areaGeometryCache ?? areaGeometryCache,
		boundaryRegistry: withRegistry.boundaryRegistry,
		geographyResolver: inputs.geographyResolver ?? built.resolver,
		areaValidation: inputs.areaValidation ?? built.validation,
		postcodes: inputs.postcodes ?? built.postcodes,
	};
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

export const crosswalkLookup = new Map<string, CrosswalkArtifact>([
	[crosswalkArtifact.id, crosswalkArtifact],
	[containmentCrosswalk.id, containmentCrosswalk],
]);

export const dataCatalog: DataCatalog = {
	schemaVersion: 1,
	contentHash: "sha256:data-catalog",
	source: {
		artifact: "data/datasets/dataset-manifest.json",
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
			id: "population",
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
					observationArtifact:
						"population-local-authority-observations",
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
			links: { data: "/v1/data/population" },
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

export const populationObservations: MeasureObservationArtifact = {
	schemaVersion: 1,
	contentHash: "sha256:population-observations",
	measureId: "population",
	sourceGeography: { type: "ward", boundaryYear: 2023 },
	periods: [
		{
			period: "2022",
			records: [
				{ areaCode: "E05000001", value: 100, status: "observed" },
				{ areaCode: "W05000001", value: 200, status: "observed" },
			],
		},
	],
};

export const populationLocalAuthorityObservations: MeasureObservationArtifact =
	{
		schemaVersion: 1,
		contentHash: "sha256:population-local-authority-observations",
		measureId: "population",
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
		areaArtifacts: { "ward/2023-05-uk-bgc": "sha256:areas" },
	},
	measures: [
		{
			measureId: "population",
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
