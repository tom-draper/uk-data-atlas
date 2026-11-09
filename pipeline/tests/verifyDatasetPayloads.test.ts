import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gzipSync } from "node:zlib";
import { test, type TestContext } from "vitest";
import { STATISTICS_DATASETS } from "@uk-data-atlas/atlas-runtime/measures";
import { verifyDatasetPayloads } from "../src/checks/verifyDatasetPayloads";

// A type whose generated payload drops a header field its compiler writes.
const dropping = STATISTICS_DATASETS.find((config) =>
	config.payload?.dropped?.includes("excludedWards"),
)!.type;

/** A root whose atlas cache holds the generated payloads, beside the compiled ones. */
function fixture(
	context: TestContext,
	datasets: {
		type: string;
		output: string;
		compiled: unknown;
		generated: unknown;
	}[],
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
	for (const { output, compiled, generated } of datasets) {
		writeFileSync(
			join(build, "datasets", `${output}.json`),
			JSON.stringify(compiled),
		);
		cache
			.prepare("INSERT INTO dataset_payload VALUES (?, ?)")
			.run(output, gzipSync(JSON.stringify(generated)));
	}
	cache.close();
	return root;
}

test("passes when the generated payload holds the compiled values", (context) => {
	const root = fixture(context, [
		{
			type: dropping,
			output: "one",
			compiled: { part: { count: 1, excludedWards: ["W1"] } },
			generated: { part: { count: 1 } },
		},
		{
			type: "fuelPoverty",
			output: "two",
			compiled: { 2023: { data: { E01: { value: 2 } } } },
			generated: { 2023: { data: { E01: { value: 2 } } } },
		},
		// Stored as is, so there is nothing generated to compare.
		{ type: "notFromRows", output: "three", compiled: {}, generated: {} },
	]);
	assert.equal(verifyDatasetPayloads(root), 2);
});

test("fails with the path of the first value that differs", (context) => {
	const root = fixture(context, [
		{
			type: dropping,
			output: "one",
			compiled: { part: { count: 1, excludedWards: [] } },
			generated: { part: { count: 2 } },
		},
	]);
	assert.throws(
		() => verifyDatasetPayloads(root),
		new RegExp(`${dropping}: statistics rows do not match.*part\\.count`),
	);
});

test("fails when fuel poverty rows differ from the compiled values", (context) => {
	const root = fixture(context, [
		{
			type: "fuelPoverty",
			output: "two",
			compiled: { 2023: { data: { E01: { value: 2 } } } },
			generated: { 2023: { data: { E01: { value: 3 } } } },
		},
	]);
	assert.throws(
		() => verifyDatasetPayloads(root),
		/fuelPoverty: statistics rows differ/,
	);
});

test("fails when the cache lacks a payload it should hold", (context) => {
	const root = fixture(context, [
		{ type: "fuelPoverty", output: "two", compiled: {}, generated: {} },
	]);
	const cache = new DatabaseSync(join(root, "data/build/atlas-cache.sqlite"));
	cache.exec("DELETE FROM dataset_payload");
	cache.close();
	assert.throws(() => verifyDatasetPayloads(root), /holds no payload/);
});
