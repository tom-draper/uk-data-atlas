import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { buildDerivedBoundaries } from "../scripts/build-derived-boundaries";

test("writes a derived GeoJSON artifact from the configured raw source selection", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const sourceDirectory = join(
		root,
		"data",
		"boundaries",
		"lsoa",
		"2011-12-ew-bgc-v3",
	);
	mkdirSync(sourceDirectory, { recursive: true });
	mkdirSync(join(root, "api", "public"), { recursive: true });
	writeFileSync(
		join(sourceDirectory, "meta.json"),
		JSON.stringify({ files: [{ path: "areas.geojson", role: "source" }] }),
	);
	writeFileSync(
		join(sourceDirectory, "areas.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			features: [
				{ properties: { LSOA11CD: "E01000001" } },
				{ properties: { LSOA11CD: "W01000001" } },
			],
		}),
	);
	const adapter = {
		source: { geography: "lsoa", boundaryRelease: "2011-12-ew-bgc-v3" },
		filter: { property: "LSOA11CD", startsWith: "W" },
	};

	try {
		const result = buildDerivedBoundaries(root, {
			"lsoa/2011-12-w-bgc": adapter,
		});
		assert.equal(result.releaseCount, 1);
		const artifact = JSON.parse(
			readFileSync(
				join(
					root,
					"api",
					"public",
					"boundaries",
					"lsoa",
					"2011-12-w-bgc.geojson",
				),
				"utf8",
			),
		);
		assert.deepEqual(artifact.features, [
			{ properties: { LSOA11CD: "W01000001" } },
		]);
		const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8"));
		assert.deepEqual(manifest.releases[0].derivedFrom, adapter);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
