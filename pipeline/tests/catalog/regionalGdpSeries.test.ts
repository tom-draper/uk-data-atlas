import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileRegionalGdp } from "../../src/catalog/regionalGdp.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("regional output partitions use canonical identities and matching hashes", () => {
	const directory = mkdtempSync(join(tmpdir(), "regional-gdp-series-"));
	try {
		const path = join(directory, "regional-gdp.json");
		writeFileSync(
			path,
			JSON.stringify(
				Object.fromEntries(
					[
						["itl1", "TLC"],
						["itl2", "TLC3"],
						["itl3", "TLC31"],
					].map(([tier, code]) => [
						tier === "itl3" ? "2023" : `${tier}-2023`,
						{
							year: 2023,
							boundaryYear: 2025,
							boundaryType: tier,
							data: {
								[code!]: {
									gvaMillionGbp: 100,
									gdpMillionGbp: 110,
								},
							},
						},
					]),
				),
			),
		);
		const manifest = {
			manifestPath: path,
			datasets: [{ id: "regional-gdp", summary: { dataRecordCount: 3 } }],
		} as CatalogManifest;
		const result = compileRegionalGdp(manifest, path);
		expect(result.artifacts).toHaveLength(6);
		for (const { contentHash, ...artifact } of result.artifacts) {
			expect([
				measureSeriesKey({ measure: "gva" }),
				measureSeriesKey({ measure: "gdp" }),
			]).toContain(artifact.measureId);
			expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
