import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { DataCatalog } from "../src/dataCatalog";
import { compileExportManifest } from "../src/exportManifest";

const catalog = {
	schemaVersion: 1,
	contentHash: "sha256:data-catalog",
	measures: [
		{
			id: "fixture",
			sources: [
				{
					datasetId: "fixture-dataset",
					periods: ["2024"],
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
} as DataCatalog;

test("lists every source artifact as a content-addressed bulk JSON export", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-export-"));
	try {
		writeFileSync(
			join(directory, "fixture-observations.json"),
			JSON.stringify({ schemaVersion: 1, contentHash: "sha256:fixture" }),
		);
		const manifest = compileExportManifest(directory, catalog);
		assert.equal(manifest.schemaVersion, 1);
		assert.match(manifest.contentHash, /^sha256:[a-f0-9]{64}$/);
		assert.deepEqual(manifest.exports, [
			{
				id: "fixture-observations",
				measureId: "fixture",
				datasetId: "fixture-dataset",
				periods: ["2024"],
				sourceGeography: { type: "ward", boundaryYear: 2024 },
				format: "json",
				artifact: "fixture-observations",
				contentHash: "sha256:fixture",
				bytes: 50,
				href: "/v1/exports/fixture-observations",
			},
		]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
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
