import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import Papa from "papaparse";
import { expect, test } from "vitest";
import { loadPlanningApplications } from "../../packages/datasets/src/data/new-datasets/loader";
import { withDuckdbPlanningApplications } from "../../pipeline/src/precompile/duckdbPublicHealth.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

test("DuckDB planning applications matches the Node reader, including malformed UTF-8", async () => {
	const root = await mkdtemp(join(tmpdir(), "planning-applications-"));
	const path = "housing/planning-applications/ps1-full-2026-03.csv";
	const csv = Papa.unparse({
		fields: [
			"LPACD",
			"LPANM",
			"Quarter",
			"Applications received",
			"Applications decided",
			"Applications withdrawn",
		],
		data: [
			["E06000001", "First", "2026 Q1", "100", "90", "5"],
			["E06000002", "Other quarter", "2025 Q4", "70", "60", "5"],
			["E06000003", "Missing", "2026 Q1", "x", "60", "5"],
			["E06000001", "Invalid BYTE name", "2026 Q1", "50", "40", "2"],
		],
	});
	const bytes = Buffer.concat([
		Buffer.from("first line\r\nsecond line\r\nthird line\r\n"),
		Buffer.from(csv.replace("BYTE", "\u00ff"), "latin1"),
	]);
	try {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), bytes);
		const baseline = await loadPlanningApplications(
			async (_path, options, visit) => {
				const content = bytes
					.toString("utf8")
					.split("\n")
					.slice(options.skipLines ?? 0)
					.join("\n");
				for (const row of Papa.parse<Record<string, string>>(content, {
					header: true,
					skipEmptyLines: true,
				}).data)
					visit(row);
			},
		);
		const { reader, artifacts } = createTrackedReader();
		const actual = await withDuckdbPlanningApplications(
			reader,
			artifacts,
			(input) => loadPlanningApplications(input.csvRows),
			root,
		);
		expect(actual).toEqual(baseline);
		expect(Object.keys(actual[2026]!.data)).toEqual(["E06000001"]);
		expect(actual[2026]!.data.E06000001!.name).toBe("Invalid \ufffd name");
		expect(artifacts.get(`csvRows:${path}`)).toMatchObject({
			bytes: bytes.length,
			sha256: createHash("sha256").update(bytes).digest("hex"),
		});
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
