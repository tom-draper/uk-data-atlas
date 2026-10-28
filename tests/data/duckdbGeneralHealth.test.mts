import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Papa from "papaparse";
import { expect, test } from "vitest";
import { loadGeneralHealth } from "../../packages/datasets/src/data/general-health/loader";
import { withDuckdbCensusLsoa } from "../../pipeline/src/precompile/duckdbPublicHealth.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

test("DuckDB general health selection preserves loader output and source tracking", async () => {
	const root = await mkdtemp(join(tmpdir(), "general-health-"));
	const path =
		"demographics/census-2021-small-area/ts037/census2021-ts037-lsoa.csv";
	const columns = [
		"geography code",
		"geography",
		"General health: Total: All usual residents",
		"General health: Very good health",
		"General health: Good health",
		"General health: Fair health",
		"General health: Bad health",
		"General health: Very bad health",
	];
	const csv = Papa.unparse({
		fields: columns,
		data: [
			[" E01000001 ", "First", "100", "40", "30", "20", "5", "5"],
			["W01000002", "Welsh", "50", "20", "10", "10", "5", "5"],
			["E02000001", "MSOA", "100", "40", "30", "20", "5", "5"],
			["E01000003", "Invalid", "100", "x", "30", "20", "5", "5"],
			["E01000001", "Replacement", "50", "20", "10", "10", "5", "5"],
		],
	});
	try {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), csv);
		const baseline = await loadGeneralHealth(
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
			(input) => loadGeneralHealth(input.csvRows),
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
