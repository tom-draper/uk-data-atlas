import {
	fixtureObservationDatabase,
	writeObservationFixture,
} from "./observationFixtures";
import assert from "node:assert/strict";
import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import type { DataCatalog } from "@uk-data-atlas/atlas-runtime/catalogue";
import { compileExportManifest } from "../../../pipeline/src/exportManifest";
import { sha256 } from "@uk-data-atlas/artifacts";
import { readParquet } from "./parquetFixtures";

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
			unit: "count",
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
		writeObservationFixture(
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
	measureId: "fixture",
	sourceGeography: { type: "ward", boundaryYear: 2024 },
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
		const manifest = compileExportManifest(
			directory,
			catalog,
			fixtureObservationDatabase(directory),
		);
		assert.equal(manifest.schemaVersion, 1);
		assert.match(manifest.contentHash, /^sha256:[a-f0-9]{64}$/);
		const [entry] = manifest.exports;
		assert.deepEqual(
			{
				...entry,
				formats: undefined,
				schema: undefined,
				provenance: undefined,
			},
			{
				id: "fixture-observations",
				measureId: "fixture",
				datasetId: "fixture-dataset",
				periods: ["2023", "2024"],
				sourceGeography: { type: "ward", boundaryYear: 2024 },
				format: "json",
				artifact: "fixture-observations",
				contentHash: "sha256:fixture",
				bytes: JSON.stringify(artifact).length + 1,
				href: "/v1/exports/fixture-observations",
				recordCount: 3,
				recordCountByPeriod: { 2023: 2, 2024: 1 },
				formats: undefined,
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

test("fails before a catalogued observation artifact exists", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-export-"));
	try {
		writeObservationFixture(join(directory, "placeholder.json"), "{}");
		assert.throws(
			() =>
				compileExportManifest(
					directory,
					catalog,
					fixtureObservationDatabase(directory),
				),
			/Missing SQLite measure observations: fixture-observations/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("publishes deterministic CSV and Parquet with exact byte sizes and hashes", () => {
	withArtifact(artifact, (directory) => {
		const entry = compileExportManifest(
			directory,
			catalog,
			fixtureObservationDatabase(directory),
		).exports[0];
		assert.deepEqual(
			entry.formats?.map((file) => file.format),
			["csv", "parquet"],
		);
		// CSV is stored gzipped; Parquet is already compressed inside.
		assert.deepEqual(
			entry.formats?.map((file) => file.artifact),
			[`exports/${entry.id}.csv.gz`, `exports/${entry.id}.parquet`],
		);
		for (const file of entry.formats ?? []) {
			const stored = readFileSync(join(directory, file.artifact));
			const body =
				file.gzipBytes === undefined ? stored : gunzipSync(stored);
			if (file.gzipBytes !== undefined)
				assert.equal(stored.length, file.gzipBytes);
			assert.equal(body.length, file.bytes);
			assert.equal(sha256(body), file.contentHash);
			assert.equal(file.href, `${entry.href}?format=${file.format}`);
		}
		const parquet = entry.formats!.find(
			(file) => file.format === "parquet",
		)!;
		const rows = readParquet(
			readFileSync(join(directory, parquet.artifact)),
		).rows;
		assert.equal(rows.length, 3);
		assert.deepEqual(
			rows.map((row) => [
				row.period,
				row.value,
				row.lowerBound,
				row.upperBound,
			]),
			[
				["2023", 1, 0, 2],
				["2023", 2, null, null],
				["2024", 3, null, null],
			],
		);
		assert.equal(rows[0].unit, "count");
		assert.equal(rows[0].datasetId, "fixture-dataset");
		assert.deepEqual(
			compileExportManifest(
				directory,
				catalog,
				fixtureObservationDatabase(directory),
			),
			compileExportManifest(
				directory,
				catalog,
				fixtureObservationDatabase(directory),
			),
		);
	});
});

test("replaces an uncompressed CSV an earlier build wrote", () => {
	withArtifact(artifact, (directory) => {
		const id = compileExportManifest(
			directory,
			catalog,
			fixtureObservationDatabase(directory),
		).exports[0].id;
		const stale = join(directory, "exports", `${id}.csv`);
		writeFileSync(stale, "stale");
		compileExportManifest(
			directory,
			catalog,
			fixtureObservationDatabase(directory),
		);
		assert.equal(existsSync(stale), false);
		assert.equal(existsSync(`${stale}.gz`), true);
	});
});

test("preserves categorical strings, CSV quoting and publisher codes", () => {
	withArtifact(
		{
			...artifact,
			periods: [
				{
					period: "2024",
					records: [
						{
							areaCode: "E05000001",
							sourceAreaCode: "OLD",
							category: 'Green, "Môn"\nParty',
							status: "observed",
						},
					],
				},
			],
		},
		(directory) => {
			const entry = compileExportManifest(
				directory,
				catalog,
				fixtureObservationDatabase(directory),
			).exports[0];
			const csv = gunzipSync(
				readFileSync(join(directory, entry.formats![0].artifact)),
			).toString("utf8");
			assert.ok(csv.includes('"Green, ""Môn""\nParty"'));
			const rows = readParquet(
				readFileSync(join(directory, entry.formats![1].artifact)),
			).rows;
			assert.equal(rows[0].category, 'Green, "Môn"\nParty');
			assert.equal(rows[0].value, null);
			assert.equal(rows[0].sourceAreaCode, "OLD");
		},
	);
});

test("projects shared tables to the named measure without losing null or zero", () => {
	withArtifact(
		{
			schemaVersion: 1,
			kind: "measure-table",
			id: "fixture-observations",
			datasetId: "fixture-dataset",
			sourceGeography: { type: "ward", boundaryYear: 2024 },
			period: "2024",
			measures: ["other", "fixture"],
			records: [
				["A", 99, 0],
				["B", 88, null],
			],
			contentHash: "sha256:table",
		},
		(directory) => {
			const entry = compileExportManifest(
				directory,
				catalog,
				fixtureObservationDatabase(directory),
			).exports[0];
			const rows = readParquet(
				readFileSync(join(directory, entry.formats![1].artifact)),
			).rows;
			assert.deepEqual(
				rows.map((row) => [row.measureId, row.areaCode, row.value]),
				[
					["fixture", "A", 0],
					["fixture", "B", null],
				],
			);
		},
	);
});
