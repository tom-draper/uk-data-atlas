import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Papa from "papaparse";
import { withDuckdbSchoolPerformance } from "../../pipeline/src/precompile/duckdbDatasetCsv.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

await test("filters both school datasets in source order and records the source", async () => {
	const root = await mkdtemp(join(tmpdir(), "school-fixture-"));
	try {
		const csv = Papa.unparse({
			fields: [
				"geographic_level",
				"geography_basis",
				"breakdown_topic",
				"lad_name",
			],
			data: [
				[
					"Local authority district",
					"Pupil residency",
					"Total",
					"South, borough",
				],
				[
					"Local authority district",
					"School location",
					"Total",
					"excluded",
				],
				[
					"Local authority district",
					"Pupil residency",
					"Disadvantage status",
					"North",
				],
				[
					"Local authority district",
					"Pupil residency",
					"Total",
					"West",
				],
			],
		});
		await writeFile(join(root, "source.csv"), csv);
		for (const [topic, expected] of [
			["Total", ["South, borough", "West"]],
			["Disadvantage status", ["North"]],
		] as const) {
			const tracked = createTrackedReader();
			const filtered = await withDuckdbSchoolPerformance(
				tracked.reader,
				tracked.artifacts,
				topic,
				(reader) => reader.text("source.csv"),
				root,
			);
			const rows = Papa.parse<Record<string, string>>(filtered, {
				header: true,
				skipEmptyLines: true,
			}).data;
			assert.deepEqual(
				rows.map((row) => row.lad_name),
				expected,
			);
			const artifact = tracked.artifacts.get("text:source.csv")!;
			assert.equal(artifact.bytes, Buffer.byteLength(csv));
			assert.equal(
				artifact.sha256,
				createHash("sha256").update(csv).digest("hex"),
			);
		}
		const tracked = createTrackedReader();
		await assert.rejects(
			withDuckdbSchoolPerformance(
				tracked.reader,
				tracked.artifacts,
				"Total",
				(reader) => reader.text("missing.csv"),
				root,
			),
			{ code: "ENOENT" },
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

await test("constituency projection preserves loader output and source tracking", async () => {
	const { loadSchoolPerformanceConstituency } =
		await import("../../packages/datasets/src/data/school-performance-constituency/loader");
	const root = await mkdtemp(join(tmpdir(), "school-constituency-"));
	try {
		const csv = Papa.unparse({
			fields: [
				"geographic_level",
				"geography_basis",
				"time_period",
				"pcon_code",
				"pcon_name",
				"engmath_94_percent",
				"engmath_95_percent",
				"attainment8_average",
				"progress8_average",
				"pupil_count",
			],
			data: [
				[
					"Parliamentary constituency",
					"Pupil residency",
					"202425",
					"E14000001",
					"North, East",
					"60",
					"40",
					"50",
					"0.1",
					"123",
				],
				[
					"Parliamentary constituency",
					"School location",
					"202425",
					"E14000001",
					"wrong",
					"10",
					"10",
					"10",
					"0",
					"10",
				],
			],
		});
		await writeFile(join(root, "source.csv"), csv);
		const path = join(
			root,
			"education/ks4-performance/ks4-constituency/202425_parliamentary_constituency_revised.csv",
		);
		await mkdir(join(root, "education/ks4-performance/ks4-constituency"), {
			recursive: true,
		});
		await writeFile(path, csv);
		const tracked = createTrackedReader();
		const actual = await withDuckdbSchoolPerformance(
			tracked.reader,
			tracked.artifacts,
			"Constituency",
			(reader) => loadSchoolPerformanceConstituency(reader.text),
			root,
		);
		const expected = await loadSchoolPerformanceConstituency(
			async () => csv,
		);
		assert.equal(JSON.stringify(actual), JSON.stringify(expected));
		assert.equal(tracked.artifacts.size, 1);
		assert.equal(
			[...tracked.artifacts.values()][0]!.sha256,
			createHash("sha256").update(csv).digest("hex"),
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
