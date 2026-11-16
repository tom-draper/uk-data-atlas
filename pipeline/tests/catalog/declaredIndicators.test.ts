import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { DatasetDeclaration } from "@uk-data-atlas/datasets";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import {
	compileDeclaredIndicators,
	compileYearlyIndicators,
} from "../../src/catalog/declaredIndicators.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("declared indicators generate canonical identities for single and yearly observations", () => {
	const directory = mkdtempSync(join(tmpdir(), "declared-series-"));
	try {
		const path = join(directory, "source.json");
		writeFileSync(
			path,
			JSON.stringify({
				"2023": {
					year: 2023,
					boundaryYear: 2025,
					boundaryType: "localAuthority",
					data: {
						E08000001: { value: 12 },
					},
				},
			}),
		);
		const manifest = {
			manifestPath: path,
			datasets: [{ id: "example", summary: { boundaryYears: [2025] } }],
		} as CatalogManifest;
		const declaration = {
			id: "example",
			boundary: { year: 2025 },
			source: { notes: [] },
			catalogue: {
				period: "2023",
				coverageNote: "",
				indicators: [
					{
						id: "old-example",
						measure: "population",
						members: { age: "child" },
						label: "Children",
						field: "value",
						valueKind: "count",
						unit: "people",
						aggregation: "sum",
						notes: [],
					},
				],
			},
		} as unknown as DatasetDeclaration;
		const single = compileDeclaredIndicators(manifest, declaration, path, {
			authorities: [],
		})[0]!.artifact;
		const yearly = compileYearlyIndicators(manifest, declaration, path)
			.artifacts[0]!;
		const expected = measureSeriesKey({
			measure: "population",
			dimensions: { age: "child" },
		});
		for (const { contentHash, ...artifact } of [single, yearly]) {
			expect(artifact.measureId).toBe(expected);
			expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
