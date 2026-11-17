import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import { compileHousePrice } from "../../src/catalog/housePrice.ts";
import type { CatalogManifest } from "../../src/catalog/manifest.ts";
import { sha256 } from "../../src/catalog/values.ts";

test("house price observations use their canonical identity and matching hash", () => {
	const directory = mkdtempSync(join(tmpdir(), "house-price-series-"));
	try {
		const path = join(directory, "house-price.json");
		writeFileSync(
			path,
			JSON.stringify({
				"2023": {
					boundaryType: "ward",
					data: { E05000001: { prices: { "2022": 150000 } } },
				},
			}),
		);
		const manifest = {
			manifestPath: path,
			datasets: [{ id: "house-price" }],
		} as CatalogManifest;
		const {
			artifact: { contentHash, ...artifact },
		} = compileHousePrice(manifest, path);
		expect(artifact.measureId).toBe(
			measureSeriesKey({ measure: "house-price-median" }),
		);
		expect(contentHash).toBe(sha256(JSON.stringify(artifact)));
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
