import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { test, type TestContext } from "vitest";
import { verifyDatasetPayloads } from "../../src/checks/verifyDatasetPayloads";

/** A root whose atlas cache holds the payloads generated from rows. */
function fixture(
	context: TestContext,
	datasets: { type: string; output: string; generated: unknown }[],
) {
	const root = mkdtempSync(join(tmpdir(), "atlas-payload-check-"));
	context.onTestFinished(() =>
		rmSync(root, { recursive: true, force: true }),
	);
	const build = join(root, "data/build");
	mkdirSync(join(build, "datasets"), { recursive: true });
	writeFileSync(
		join(build, "datasets/dataset-manifest.json"),
		JSON.stringify({
			datasets: datasets.map(({ type, output }) => ({ type, output })),
		}),
	);
	const cache = new DatabaseSync(join(build, "atlas-cache.sqlite"));
	cache.exec(
		"CREATE TABLE dataset_payload (output TEXT NOT NULL PRIMARY KEY, gzip BLOB NOT NULL)",
	);
	for (const { output, generated } of datasets)
		cache
			.prepare("INSERT INTO dataset_payload VALUES (?, ?)")
			.run(output, gzipSync(JSON.stringify(generated)));
	cache.close();
	return root;
}

test("skips a dataset stored as is, which has nothing generated to check", (context) => {
	const root = fixture(context, [
		{ type: "notFromRows", output: "three", generated: {} },
	]);
	assert.equal(verifyDatasetPayloads(root), 0);
});

test("fails when a generated payload is not its golden", (context) => {
	const root = fixture(context, [
		{ type: "fuel-poverty", output: "two", generated: { 2023: {} } },
	]);
	assert.throws(
		() => verifyDatasetPayloads(root),
		/fuel-poverty: the payload generated from its rows is .* not the golden/,
	);
});

test("fails when the cache lacks a payload it should hold", (context) => {
	const root = fixture(context, [
		{ type: "fuel-poverty", output: "two", generated: {} },
	]);
	const cache = new DatabaseSync(join(root, "data/build/atlas-cache.sqlite"));
	cache.exec("DELETE FROM dataset_payload");
	cache.close();
	assert.throws(() => verifyDatasetPayloads(root), /holds no payload/);
});
