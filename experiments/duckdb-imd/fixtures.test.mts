import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Papa from "papaparse";
import { loadIMD } from "../../packages/datasets/src/data/imd/loader";
import { withDuckdbImd } from "../../pipeline/src/precompile/duckdbDatasetCsv.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

await test("deprivation selection matches the loader and tracks the raw source", async () => {
	const root = await mkdtemp(join(tmpdir(), "duckdb-imd-"));
	const path =
		"deprivation/imd/File_7_IoD2025_All_Ranks_Scores_Deciles_Population_Denominators.csv";
	try {
		await mkdir(join(root, "deprivation/imd"), { recursive: true });
		const fields = [
			"LSOA code (2021)",
			"LSOA name (2021)",
			"Local Authority District code (2024)",
			"Local Authority District name (2024)",
			"Index of Multiple Deprivation (IMD) Score",
			"Index of Multiple Deprivation (IMD) Rank (where 1 is most deprived)",
			"Index of Multiple Deprivation (IMD) Decile (where 1 is most deprived 10% of LSOAs)",
			"Income Score (rate)",
			"Employment Score (rate)",
			"Education, Skills and Training Score",
			"Health Deprivation and Disability Score",
			"Crime Score",
			"Barriers to Housing and Services Score",
			"Living Environment Score",
			"Total population: mid 2022",
		];
		const row = (code: string, score: string) => [
			code,
			"North, area",
			"E06000001",
			"District",
			score,
			"1",
			"1",
			"0.1",
			"0.2",
			"2",
			"3",
			"4",
			"5",
			"6",
			"1000",
		];
		const csv = Papa.unparse({
			fields,
			data: [
				row("E01000001", "12.5"),
				row("W01000001", "7"),
				row("E01000002", "18"),
			],
		});
		await writeFile(join(root, path), csv);
		const tracked = createTrackedReader();
		const result = await withDuckdbImd(
			tracked.reader,
			tracked.artifacts,
			(reader) => loadIMD(reader.text),
			root,
		);
		assert.equal(
			JSON.stringify(result),
			JSON.stringify(await loadIMD(async () => csv)),
		);
		assert.equal(Object.keys(result[2025]!.data).length, 2);
		assert.equal(
			tracked.artifacts.get(`text:${path}`)!.sha256,
			createHash("sha256").update(csv).digest("hex"),
		);
		await rm(join(root, path));
		await assert.rejects(
			withDuckdbImd(
				tracked.reader,
				new Map(),
				(reader) => loadIMD(reader.text),
				root,
			),
			{ code: "ENOENT" },
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
