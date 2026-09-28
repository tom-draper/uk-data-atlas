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
			aggregation: {
				kind: "extensive",
				operation: "sum",
				available: true,
			},
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
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: true,
			},
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

test("gates a reviewed path on exact coverage and conservation through every step", () => {
	const authorityToRegion = {
		...crosswalk,
		contentHash: "sha256:authority-region",
		id: "fixture-authority-to-region",
		from: crosswalk.to,
		to: { geography: "region", boundaryRelease: "2023-05-en-rgn" },
		records: [
			{
				source: { code: "E08000001", labels: ["Target"] },
				targets: [{ code: "E12000002", labels: ["Region"] }],
			},
		],
	} as unknown as CrosswalkArtifact;
	const [reviewed] = analysisGeographies.supports;
	const pathSupport = (
		second: CrosswalkArtifact,
	): AnalysisGeographyInventory => ({
		...analysisGeographies,
		supports: [
			{
				...reviewed!,
				analysisGeography: second.to,
				crosswalk: undefined,
				path: {
					id: "fixture-path",
					purpose: "membership",
					origin: "declared",
					quality: "publisher-supplied",
					steps: [crosswalk, second].map((artifact) => ({
						crosswalk: {
							id: artifact.id,
							method: artifact.method,
							quality: artifact.quality,
						},
						direction: "forward" as const,
					})),
				},
			},
		],
	});
	const values = observations([
		{ areaCode: "E01000001", value: 40 },
		{ areaCode: "E01000002", value: 60 },
	]);

	const validated = validateAnalysisGeographies(
		pathSupport(authorityToRegion),
		catalogue,
		new Map([
			[crosswalk.id, crosswalk],
			[authorityToRegion.id, authorityToRegion],
		]),
		values,
	);
	const [support] = validated.supports;
	assert.equal(support?.crosswalk, undefined);
	assert.deepEqual(support?.path, {
		id: "fixture-path",
		crosswalks: [
			{
				id: crosswalk.id,
				contentHash: "sha256:crosswalk",
				direction: "forward",
			},
			{
				id: authorityToRegion.id,
				contentHash: "sha256:authority-region",
				direction: "forward",
			},
		],
	});
	assert.deepEqual(support?.periods[0], {
		period: "2025",
		method: "exact",
		inputRecordCount: 2,
		outputRecordCount: 1,
		inputTotal: 100,
		outputTotal: 100,
	});

	// A later step that drops the authority would lose every value.
	const dropping = {
		...authorityToRegion,
		records: [
			{
				source: { code: "E08000999", labels: [] },
				targets: [{ code: "E12000002", labels: [] }],
			},
		],
	} as unknown as CrosswalkArtifact;
	assert.throws(
		() =>
			validateAnalysisGeographies(
				pathSupport(dropping),
				catalogue,
				new Map([
					[crosswalk.id, crosswalk],
					[dropping.id, dropping],
				]),
				values,
			),
		/Step 2 of the path/,
	);
});
