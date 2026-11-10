import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { closeAllReadOnlyDatabases } from "@uk-data-atlas/atlas-db";
import { publishDatasets } from "../../src/precompile/publishDatasets.ts";
import type {
	CatalogueDefinition,
	CompiledDatasets,
} from "../../src/precompile/types.ts";

test("publishes from base-database metadata and loads regional payloads lazily", async () => {
	const root = mkdtempSync(join(tmpdir(), "dataset-publish-"));
	const dir = join(root, "data/build");
	mkdirSync(dir, { recursive: true });
	const db = new DatabaseSync(join(dir, "atlas-base.sqlite"));
	try {
		db.exec(
			"CREATE TABLE payloads (id TEXT PRIMARY KEY, payload TEXT); CREATE TABLE dataset (slug TEXT, compiled_type TEXT, compiled_sha256 TEXT, payload_id TEXT)",
		);
		const manifest = {
			datasets: [{ type: "sample", output: "sample", fingerprint: "v1" }],
		};
		const payload = { 2024: { data: { A: { value: 1 } } } };
		const insert = db.prepare("INSERT INTO payloads VALUES (?, ?)");
		insert.run("dataset-manifest", JSON.stringify(manifest));
		insert.run("dataset:sample", JSON.stringify(payload));
		db.exec(
			"INSERT INTO dataset VALUES ('sample', 'sample', 'hash', 'dataset:sample')",
		);
		const definition = {
			type: "sample",
			precompiledFile: "sample",
			payload: { regionChunks: { kind: "regional" } },
		} as unknown as CatalogueDefinition;
		const loaded: CompiledDatasets = new Map();
		expect(
			await publishDatasets([definition], loaded, { sample: "v1" }, root),
		).toEqual(manifest.datasets);
		expect(loaded.has("sample")).toBe(true);
		expect(await loaded.get("sample")!.load()).toEqual(payload);
		await expect(
			publishDatasets([definition], new Map(), { sample: "old" }, root),
		).rejects.toThrow(/out of date/);
	} finally {
		closeAllReadOnlyDatabases();
		db.close();
		rmSync(root, { recursive: true, force: true });
	}
});
