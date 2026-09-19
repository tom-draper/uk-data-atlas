import assert from "node:assert/strict";
import test from "node:test";
import { validateAnalysisGeographies } from "../src/analysisGeographyValidation";
import type { AnalysisGeographyInventory } from "../src/analysisGeographies";
import type { CrosswalkArtifact } from "../src/crosswalkInventory";
import type {
	AnyMeasureObservationArtifact,
	DataCatalog,
} from "../src/dataCatalog";

const analysisGeographies: AnalysisGeographyInventory = {
	schemaVersion: 1,
	contentHash: "sha256:analysis",
	dataCatalogHash: "sha256:catalogue",
	crosswalkInventoryHash: "sha256:crosswalks",
	supports: [
		{
			measureId: "fixture",
			analysisGeography: {
				geography: "localAuthority",
				boundaryRelease: "2023-05-uk-bgc-v2",
			},
			source: {
				datasetId: "fixture-dataset",
				geography: "lsoa",
				boundaryYear: 2021,
				periods: ["2025"],
			},
			crosswalk: {
				id: "fixture-crosswalk",
				method: "clean-containment",
				quality: "publisher-supplied",
			},
			note: "Exact regrouping.",
		},
	],
};

const catalogue = {
	schemaVersion: 1,
	contentHash: "sha256:catalogue",
	datasets: [],
	measures: [
		{
			id: "fixture",
			label: "Fixture",
			valueKind: "count",
			unit: "things",
			aggregation: { kind: "extensive", operation: "sum", available: true },
			sources: [
				{
					datasetId: "fixture-dataset",
					observationArtifact: "fixture-observations",
					periods: ["2025"],
					sourceGeography: { type: "lsoa", boundaryYear: 2021 },
					coverage: {
						kind: "partial",
						countries: ["GB-ENG"],
						recordCount: 2,
						note: "Fixture.",
					},
				},
			],
			availability: { sourceExact: true, conversion: false, aggregation: true },
			links: { data: "/v1/data/fixture" },
		},
	],
} as unknown as DataCatalog;

const crosswalk = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalk",
	id: "fixture-crosswalk",
	method: "clean-containment",
	quality: "publisher-supplied",
	weighting: { status: "not-applicable" },
	from: { geography: "lsoa", boundaryRelease: "2021-12-ew-bgc" },
	to: {
		geography: "localAuthority",
		boundaryRelease: "2023-05-uk-bgc-v2",
	},
	provenance: { input: "fixture.geojson", inputHash: "sha256:input" },
	validation: { sourceNameConflicts: [], endpoints: {} },
	records: [
		{
			source: { code: "E01000001", labels: ["Source one"] },
			targets: [{ code: "E08000001", labels: ["Target"] }],
		},
		{
			source: { code: "E01000002", labels: ["Source two"] },
			targets: [{ code: "E08000001", labels: ["Target"] }],
		},
	],
} as unknown as CrosswalkArtifact;

const observations = (records: Array<{ areaCode: string; value: number }>) =>
	new Map<string, AnyMeasureObservationArtifact>([
		[
			"fixture-observations",
			{
				schemaVersion: 1,
				contentHash: "sha256:observations",
				measureId: "fixture",
				sourceGeography: { type: "lsoa", boundaryYear: 2021 },
				periods: [
					{
						period: "2025",
						records: records.map((record) => ({
							...record,
							status: "observed" as const,
						})),
					},
				],
			},
		],
	]);

test("gates a reviewed analysis pair on exact coverage and conservation", () => {
	const validated = validateAnalysisGeographies(
		analysisGeographies,
		catalogue,
		new Map([[crosswalk.id, crosswalk]]),
		observations([
			{ areaCode: "E01000001", value: 40 },
			{ areaCode: "E01000002", value: 60 },
		]),
	);
	assert.deepEqual(validated.supports[0]?.periods, [
		{
			period: "2025",
			method: "exact",
			inputRecordCount: 2,
			outputRecordCount: 1,
			inputTotal: 100,
			outputTotal: 100,
		},
	]);
	assert.throws(
		() =>
			validateAnalysisGeographies(
				analysisGeographies,
				catalogue,
				new Map([[crosswalk.id, crosswalk]]),
				observations([{ areaCode: "E01009999", value: 100 }]),
			),
		/source-areas-not-mapped|does not carry/,
	);
});
