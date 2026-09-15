import assert from "node:assert/strict";
import test from "node:test";
import type { AreaReleaseArtifact } from "../src/areaInventory";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import type {
	DataCatalog,
	MeasureObservationArtifact,
	PopulationLocalAuthorityObservationArtifact,
	PopulationObservationArtifact,
} from "../src/dataCatalog";
import { compileMeasureCompatibility } from "../src/measureCompatibility";

const dataCatalog: DataCatalog = {
	schemaVersion: 1,
	contentHash: "sha256:catalog",
	source: {
		artifact: "data/precompiled/dataset-manifest.json",
		manifestVersion: 1,
	},
	datasets: [],
	measures: [
		{
			id: "population-estimate",
			label: "Population estimate",
			valueKind: "count",
			unit: "people",
			aggregation: {
				kind: "extensive",
				operation: "sum",
				available: false,
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
						note: "England and Wales.",
					},
				},
				{
					datasetId: "population-uk",
					periods: ["2024"],
					sourceGeography: {
						type: "localAuthority",
						boundaryYear: 2023,
					},
					coverage: {
						kind: "source-reported",
						countries: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"],
						recordCount: 2,
						note: "UK.",
					},
				},
			],
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: false,
			},
			links: { data: "/v1/data/population-estimate" },
		},
	],
};

const boundaryRegistry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [
		{
			id: "2023-05-uk-ward",
			geography: "ward",
			title: "Wards, May 2023",
			temporalCoverage: "2023",
			coverage: { countries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"] },
			source: {
				publisher: "ONS",
				url: "https://example.com",
				licence: { name: "OGL" },
			},
			metadataHash: "sha256:ward",
		},
		{
			id: "2023-05-uk-lad",
			geography: "localAuthority",
			title: "Local authorities, May 2023",
			temporalCoverage: "2023",
			coverage: { countries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"] },
			source: {
				publisher: "ONS",
				url: "https://example.com",
				licence: { name: "OGL" },
			},
			metadataHash: "sha256:local-authority",
		},
	],
};

const artifacts: AreaReleaseArtifact[] = [
	{
		schemaVersion: 1,
		contentHash: "sha256:wards",
		geography: "ward",
		boundaryRelease: "2023-05-uk-ward",
		codeProperty: "WD23CD",
		nameProperty: "WD23NM",
		areas: [
			{ code: "E05000001", name: "England ward" },
			{ code: "W05000001", name: "Wales ward" },
			{ code: "S13000001", name: "Scotland ward" },
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:local-authorities",
		geography: "localAuthority",
		boundaryRelease: "2023-05-uk-lad",
		codeProperty: "LAD23CD",
		nameProperty: "LAD23NM",
		areas: [
			{ code: "E06000001", name: "England LA" },
			{ code: "N09000001", name: "Northern Ireland LA" },
		],
	},
];

const wardObservations: PopulationObservationArtifact = {
	schemaVersion: 1,
	contentHash: "sha256:ward-observations",
	measureId: "population-estimate",
	period: "2022",
	sourceGeography: { type: "ward", boundaryYear: 2023 },
	records: [
		{ areaCode: "E05000001", value: 1, status: "observed" },
		{ areaCode: "W05000001", value: 1, status: "observed" },
	],
};

const localAuthorityObservations: PopulationLocalAuthorityObservationArtifact =
	{
		schemaVersion: 1,
		contentHash: "sha256:local-authority-observations",
		measureId: "population-estimate",
		sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
		periods: [
			{
				period: "2024",
				records: [
					{ areaCode: "E06000001", value: 1, status: "observed" },
					{ areaCode: "N09000001", value: 1, status: "observed" },
				],
			},
		],
	};

/** This fixture publishes only the population measure, so it goes unread. */
const emissionsObservations: MeasureObservationArtifact = {
	schemaVersion: 1,
	contentHash: "sha256:emissions-observations",
	measureId: "ghg-emissions",
	sourceGeography: { type: "localAuthority", boundaryYear: 2025 },
	periods: [],
};

test("reports code compatibility without claiming geometry equivalence", () => {
	const inventory = compileMeasureCompatibility(
		dataCatalog,
		boundaryRegistry,
		artifacts,
		wardObservations,
		localAuthorityObservations,
		[emissionsObservations],
	);
	const sources = inventory.measures[0]?.sources;
	assert.equal(sources?.[0]?.candidates[0]?.status, "code-set-compatible");
	assert.equal(sources?.[0]?.candidates[0]?.candidateOnlyCodeCount, 1);
	assert.equal(sources?.[0]?.candidates[0]?.unmatchedSourceCodeCount, 0);
	assert.equal(sources?.[1]?.candidates[0]?.status, "exact-code-set");
	assert.match(sources?.[0]?.note ?? "", /code-set compatibility only/);
	assert.match(inventory.contentHash, /^sha256:[a-f0-9]{64}$/);
});

test("assesses the codes of every period in a partition, not only the first", () => {
	const catalogue: DataCatalog = {
		...dataCatalog,
		measures: dataCatalog.measures.map((measure) => ({
			...measure,
			sources: measure.sources.map((source) =>
				source.datasetId === "population-uk"
					? { ...source, periods: ["2024", "2025"] }
					: source,
			),
		})),
	};
	const inventory = compileMeasureCompatibility(
		catalogue,
		boundaryRegistry,
		artifacts,
		wardObservations,
		{
			...localAuthorityObservations,
			periods: [
				...localAuthorityObservations.periods,
				{
					period: "2025",
					records: [
						{ areaCode: "E06000001", value: 1, status: "observed" },
						{ areaCode: "E06000099", value: 1, status: "observed" },
					],
				},
			],
		},
		[emissionsObservations],
	);
	const candidate = inventory.measures[0]?.sources[1]?.candidates[0];
	assert.equal(candidate?.status, "partial-code-overlap");
	assert.equal(candidate?.sourceCodeCount, 3);
	assert.deepEqual(candidate?.unmatchedSourceCodeSample, ["E06000099"]);
	assert.throws(
		() =>
			compileMeasureCompatibility(
				catalogue,
				boundaryRegistry,
				artifacts,
				wardObservations,
				localAuthorityObservations,
				[emissionsObservations],
			),
		/No population-estimate observations exist for localAuthority in 2025\./,
	);
});
