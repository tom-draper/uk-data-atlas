import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Papa from "papaparse";
import { expect, test } from "vitest";
import { loadHousingTenure } from "../../packages/datasets/src/data/housing-tenure/loader";
import { withDuckdbCensusLsoa } from "../../pipeline/src/precompile/duckdbPublicHealth.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

test("DuckDB housing tenure selection preserves loader output and source tracking", async () => {
	const root = await mkdtemp(join(tmpdir(), "housing-tenure-"));
	const path =
		"demographics/census-2021-small-area/ts054/census2021-ts054-lsoa.csv";
	const csv = Papa.unparse({
		fields: [
			"geography code",
			"geography",
			"Tenure of household: Total: All households",
			"Tenure of household: Owned",
			"Tenure of household: Owned: Owns outright",
			"Tenure of household: Owned: Owns with a mortgage or loan",
			"Tenure of household: Shared ownership",
			"Tenure of household: Social rented",
			"Tenure of household: Private rented",
			"Tenure of household: Lives rent free",
		],
		data: [
			[
				" E01000001 ",
				"First",
				"100",
				"60",
				"30",
				"30",
				"5",
				"20",
				"10",
				"5",
			],
			["W01000002", "Welsh", "50", "30", "15", "15", "2", "10", "6", "2"],
			[
				"E02000001",
				"MSOA",
				"100",
				"60",
				"30",
				"30",
				"5",
				"20",
				"10",
				"5",
			],
			[
				"E01000003",
				"Invalid",
				"100",
				"x",
				"30",
				"30",
				"5",
				"20",
				"10",
				"5",
			],
			[
				"E01000001",
				"Replacement",
				"50",
				"30",
				"15",
				"15",
				"2",
				"10",
				"6",
				"2",
			],
		],
	});
	try {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), csv);
		const baseline = await loadHousingTenure(
			async (_path, _options, visit) => {
				for (const row of Papa.parse<Record<string, string>>(csv, {
					header: true,
					skipEmptyLines: true,
				}).data)
					visit(row);
			},
		);
		const { reader, artifacts } = createTrackedReader();
		const actual = await withDuckdbCensusLsoa(
			reader,
			artifacts,
			(input) => loadHousingTenure(input.csvRows),
			root,
		);
		expect(actual).toEqual(baseline);
		expect(Object.keys(actual[2021]!.data)).toEqual([
			"E01000001",
			"W01000002",
		]);
		expect(actual[2021]!.data.E01000001!.name).toBe("Replacement");
		expect(artifacts.get(`csvRows:${path}`)).toMatchObject({
			bytes: Buffer.byteLength(csv),
			sha256: createHash("sha256").update(csv).digest("hex"),
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
