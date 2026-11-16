import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { roadCollisionSeries } from "@uk-data-atlas/datasets";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileRoadCollisions } from "../../src/catalog/roadCollisions.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("road collision observations use declared severity series across periods", () => {
	const root = mkdtempSync(join(tmpdir(), "collision-series-"));
	try {
		const path = join(root, "source.json");
		const record = { collisions: 6, fatal: 1, serious: 2, slight: 3 };
		writeFileSync(
			path,
			JSON.stringify(
				Object.fromEntries(
					[2024, 2025].map((year) => [
						year,
						{
							year,
							boundaryYear: 2024,
							boundaryType: "localAuthority",
							data: { E08000001: record },
							lsoas: { E01000001: record },
						},
					]),
				),
			),
		);
		const manifest = {
			manifestPath: path,
			datasets: [
				{ id: "road-collisions", summary: { boundaryYears: [2024] } },
			],
		} as CatalogManifest;
		const results = compileRoadCollisions(
			manifest,
			path,
			new Set(["E08000001"]),
		);
		const expected = new Set(roadCollisionSeries().map(measureSeriesKey));
		expect(results).toHaveLength(8);
		for (const {
			artifact: { contentHash, ...artifact },
		} of results) {
			expect(expected.has(artifact.measureId)).toBe(true);
			expect(artifact.periods).toHaveLength(2);
			expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
