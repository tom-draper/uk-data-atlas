import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { buildAnalysisGeographyValidation } from "../src/buildAnalysisGeographyValidation";
import assert from "node:assert/strict";
import { test } from "vitest";
import { validateAnalysisGeographies } from "@uk-data-atlas/atlas-runtime/areas";
import type { AnalysisGeographyInventory } from "@uk-data-atlas/atlas-runtime/relationships";
import type { CrosswalkArtifact } from "@uk-data-atlas/atlas-runtime/relationships";
import type {
	AnyMeasureObservationArtifact,
	DataCatalog,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import type { MeasureTableArtifact } from "@uk-data-atlas/atlas-runtime/catalogue";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";

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

test("gates a reviewed measure read from a shared census table", () => {
	const table: MeasureTableArtifact = {
		schemaVersion: 1,
		kind: "measure-table",
		contentHash: "sha256:table",
		id: "fixture-table",
		datasetId: "fixture-dataset",
		sourceGeography: { type: "lsoa", boundaryYear: 2021 },
		period: "2025",
		measures: ["other", "fixture"],
		records: [
			["E01000001", 1, 40],
			["E01000002", 2, 60],
		],
	};
	const tableCatalogue = {
		...catalogue,
		measures: catalogue.measures.map((measure) => ({
			...measure,
			sources: measure.sources.map((source) => ({
				...source,
				observationArtifact: table.id,
			})),
		})),
	} as DataCatalog;

	const validated = validateAnalysisGeographies(
		analysisGeographies,
		tableCatalogue,
		new Map([[crosswalk.id, crosswalk]]),
		new Map([[table.id, table]]),
	);
	const [support] = validated.supports;
	// The receipt names the table, since that is the artifact read.
	assert.deepEqual(support?.observations, {
		artifact: "fixture-table",
		contentHash: "sha256:table",
	});
	assert.equal(support?.periods[0]?.inputTotal, 100);
	assert.equal(support?.periods[0]?.outputTotal, 100);
});

test("analysis validation builds from statistics rows", (t) => {
	const root = mkdtempSync(join(tmpdir(), "analysis-observations-"));
	t.onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const publicRoot = artifactDirectory(root);
	mkdirSync(join(publicRoot, "crosswalks"), { recursive: true });
	mkdirSync(join(root, "data/build/geography"), { recursive: true });
	const database = new DatabaseSync(
		join(root, "data/build/atlas-base.sqlite"),
	);
	database.exec(`
		CREATE TABLE dataset (id INTEGER, slug TEXT);
		CREATE TABLE measure (id INTEGER, slug TEXT);
		CREATE TABLE series (id INTEGER, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER);
		CREATE TABLE area_releases (id INTEGER, geography TEXT, release TEXT);
		CREATE TABLE dimension (id INTEGER, slug TEXT);
		CREATE TABLE dimension_member (id INTEGER, code TEXT);
		CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
		CREATE TABLE area (id INTEGER, code TEXT);
		CREATE TABLE area_version (id INTEGER, area_id INTEGER);
		CREATE TABLE period (id INTEGER, label TEXT);
		CREATE TABLE status (id INTEGER, slug TEXT);
		CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, value REAL, lower REAL, upper REAL, status_id INTEGER);
		INSERT INTO dataset VALUES (1, 'fixture-dataset');
		INSERT INTO measure VALUES (1, 'fixture');
		INSERT INTO area_releases VALUES (1, 'lsoa', '2021');
		INSERT INTO series VALUES (1, 1, 1, 1);
		INSERT INTO area VALUES (1, 'E01000001'), (2, 'E01000002');
		INSERT INTO area_version VALUES (1, 1), (2, 2);
		INSERT INTO period VALUES (1, '2025');
		INSERT INTO status VALUES (1, 'observed');
		INSERT INTO observation VALUES (1, 1, 1, 40, NULL, NULL, 1), (1, 2, 1, 60, NULL, NULL, 1);
	`);
	database.close();
	writeFileSync(
		join(root, "data/build/statistics-read-path.json"),
		JSON.stringify({
			schemaVersion: 1,
			dataCatalogHash: catalogue.contentHash,
			statistics: {
				"fixture-observations": {
					datasetId: "fixture-dataset",
					measure: "fixture",
					dimensions: {},
					geography: "lsoa",
				},
			},
			observations: {},
		}),
	);
	const builtCatalogue = {
		...catalogue,
		datasets: [{ id: "fixture-dataset" }],
	};
	writeFileSync(
		join(publicRoot, "data-catalog.json"),
		JSON.stringify(builtCatalogue),
	);
	writeFileSync(
		join(publicRoot, "crosswalk-inventory.json"),
		JSON.stringify({
			crosswalks: [
				{ id: crosswalk.id, artifact: "crosswalks/fixture.json" },
			],
		}),
	);
	writeFileSync(
		join(publicRoot, "crosswalks/fixture.json"),
		JSON.stringify(crosswalk),
	);
	writeFileSync(
		join(root, "data/build/geography/analysis-geographies.json"),
		JSON.stringify(analysisGeographies),
	);
	const result = buildAnalysisGeographyValidation(root);
	assert.equal(result.count, 1);
	const built = JSON.parse(
		readFileSync(result.outputPath, "utf8"),
	) as ReturnType<typeof validateAnalysisGeographies>;
	assert.equal(built.supports[0]?.periods[0]?.inputTotal, 100);
	assert.equal(built.supports[0]?.periods[0]?.outputTotal, 100);
});
