import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { DataCatalog } from "../src/dataCatalog";
import { compileExportManifest } from "../src/exportManifest";

const dataset = (id: string) => ({
	id,
	publisher: `${id} publisher`,
	sourceUrl: `https://example.com/${id}`,
	licence: { name: "OGL" },
	inputs: [
		{ kind: "text", path: `${id}.csv`, bytes: 10, sha256: `${id}-hash` },
	],
});

const catalog = {
	schemaVersion: 1,
	contentHash: "sha256:data-catalog",
	datasets: [dataset("fixture-dataset"), dataset("land-area")],
	measures: [
		{
			id: "fixture",
			derivedFrom: {
				datasetIds: ["fixture-dataset", "land-area"],
				note: "Divided by land area.",
			},
			sources: [
				{
					datasetId: "fixture-dataset",
					periods: ["2023", "2024"],
					sourceGeography: { type: "ward", boundaryYear: 2024 },
					coverage: {
						kind: "source-reported",
						countries: ["GB-ENG"],
						recordCount: 1,
						note: "Fixture.",
					},
				},
			],
		},
	],
} as unknown as DataCatalog;

const withArtifact = (artifact: object, run: (directory: string) => void) => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-export-"));
	try {
		writeFileSync(
			join(directory, "fixture-observations.json"),
			JSON.stringify(artifact),
		);
		run(directory);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
};

const artifact = {
	schemaVersion: 1,
	contentHash: "sha256:fixture",
	periods: [
		{
			period: "2023",
			records: [
				{
					areaCode: "E05000001",
					value: 1,
					status: "derived",
					confidenceInterval: { lower: 0, upper: 2 },
				},
				{ areaCode: "E05000002", value: 2, status: "derived" },
			],
		},
		{
			period: "2024",
			records: [{ areaCode: "E05000001", value: 3, status: "derived" }],
		},
	],
};

test("describes each export's records, schema and provenance from its artifact", () => {
	withArtifact(artifact, (directory) => {
		const manifest = compileExportManifest(directory, catalog);
		assert.equal(manifest.schemaVersion, 1);
		assert.match(manifest.contentHash, /^sha256:[a-f0-9]{64}$/);
		const [entry] = manifest.exports;
		assert.deepEqual(
			{ ...entry, schema: undefined, provenance: undefined },
			{
				id: "fixture-observations",
				measureId: "fixture",
				datasetId: "fixture-dataset",
				periods: ["2023", "2024"],
				sourceGeography: { type: "ward", boundaryYear: 2024 },
				format: "json",
				artifact: "fixture-observations",
				contentHash: "sha256:fixture",
				bytes: JSON.stringify(artifact).length,
				href: "/v1/exports/fixture-observations",
				recordCount: 3,
				recordCountByPeriod: { 2023: 2, 2024: 1 },
				schema: undefined,
				provenance: undefined,
			},
		);
		assert.equal(entry.schema.layout, "periods");
		assert.equal(entry.schema.recordType, "numeric");
		assert.deepEqual(
			entry.schema.fields.map(({ name, type, required }) => [
				name,
				type,
				required,
			]),
			[
				["areaCode", "string", true],
				["value", "number", true],
				["status", "string", true],
				["confidenceInterval", "object", false],
			],
		);
		assert.deepEqual(entry.provenance.datasets, [
			{ id: "fixture-dataset", role: "source" },
			{ id: "land-area", role: "derived-from" },
		]);
		assert.deepEqual(manifest.datasets["land-area"], {
			publisher: "land-area publisher",
			sourceUrl: "https://example.com/land-area",
			licence: { name: "OGL" },
			inputs: [{ path: "land-area.csv", sha256: "land-area-hash" }],
			href: "/v1/datasets/land-area",
		});
		assert.deepEqual(Object.keys(manifest.fields), [
			"areaCode",
			"value",
			"status",
			"confidenceInterval",
		]);
		assert.equal(entry.provenance.measure, "/v1/measures/fixture");
	});
});

test("refuses a record field the export schema does not describe", () => {
	withArtifact(
		{
			...artifact,
			periods: [
				{
					period: "2023",
					records: [{ areaCode: "E05000001", value: 1, rank: 4 }],
				},
			],
		},
		(directory) =>
			assert.throws(
				() => compileExportManifest(directory, catalog),
				/records carry rank, which the export schema does not describe/,
			),
	);
});

test("fails before a catalogued observation artifact exists", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-export-"));
	try {
		assert.throws(
			() => compileExportManifest(directory, catalog),
			/fixture-observations.json/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
