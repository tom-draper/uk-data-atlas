import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Papa from "papaparse";
import { afterEach, test } from "node:test";
import { strict as assert } from "node:assert";
import { loadPublicHealth } from "../../packages/datasets/src/data/public-health/loader";
import { withDuckdbPublicHealth } from "../../pipeline/src/precompile/duckdbPublicHealth.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

let root = "";
afterEach(async () => {
	if (root) await rm(root, { recursive: true, force: true });
});

test("DuckDB preserves public health selection, order, and source hashes", async () => {
	root = await mkdtemp(join(tmpdir(), "public-health-"));
	const dir = join(root, "health/public-health-outcomes-framework");
	await mkdir(dir, { recursive: true });
	const columns = [
		"Indicator ID",
		"Age",
		"Sex",
		"Category",
		"Category Type",
		"Area Type",
		"Area Code",
		"Time period Sortable",
		"Time period",
		"Value",
		"Area Name",
	];
	const make = (
		id: string,
		code: string,
		period: string,
		value: string,
		sex = "Persons",
	) => [
		id,
		"18+ yrs",
		sex,
		"",
		"",
		"Counties & UAs (from Apr 2023)",
		code,
		period,
		period,
		value,
		code,
	];
	const contents = [
		Papa.unparse({
			fields: columns,
			data: [
				make("92443", "E06000002", "2023", "3"),
				make("92443", "E06000001", "2024", "4"),
				make("92443", "E06000002", "2024", "x"),
				make("92443", "E06000003", "2024", "8", "Female"),
			],
		}),
		Papa.unparse({
			fields: columns,
			data: [make("92443", "E06000002", "2024", "5")],
		}),
	];
	const names = [
		"health-improvement.csv",
		"healthcare-premature-mortality.csv",
	];
	for (let i = 0; i < names.length; i++)
		await writeFile(join(dir, names[i]!), contents[i]!);
	const baseline = createTrackedReader();
	baseline.reader.csvRows = async (path, _options, visit) => {
		const csv = await readFile(join(root, path), "utf8");
		for (const row of Papa.parse<Record<string, string>>(csv, {
			header: true,
			skipEmptyLines: true,
		}).data)
			visit(row);
	};
	const expected = await loadPublicHealth(baseline.reader.csvRows);
	const candidate = createTrackedReader();
	const result = await withDuckdbPublicHealth(
		candidate.reader,
		candidate.artifacts,
		(reader) => loadPublicHealth(reader.csvRows),
		root,
	);
	assert.equal(JSON.stringify(result), JSON.stringify(expected));
	assert.deepEqual(Object.keys(result[2025]!.data), [
		"E06000001",
		"E06000002",
	]);
	assert.equal(result[2025]!.data.E06000002!.metrics.smoking, 5);
	assert.equal(candidate.artifacts.size, 2);
	for (let i = 0; i < names.length; i++) {
		const item = candidate.artifacts.get(
			`csvRows:health/public-health-outcomes-framework/${names[i]}`,
		)!;
		assert.equal(
			item.sha256,
			createHash("sha256").update(contents[i]!).digest("hex"),
		);
		assert.equal(item.bytes, Buffer.byteLength(contents[i]!));
	}
	await rm(join(dir, names[0]!));
	await assert.rejects(
		withDuckdbPublicHealth(
			candidate.reader,
			new Map(),
			(reader) => loadPublicHealth(reader.csvRows),
			root,
		),
		{ code: "ENOENT" },
	);
});
