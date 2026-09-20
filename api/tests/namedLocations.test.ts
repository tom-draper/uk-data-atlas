import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { compileNamedLocations } from "../src/namedLocations";

test("compiles curated gazetteer locations as explicitly editorial definitions", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-named-locations-"));
	try {
		const source = join(root, "gazetteer.core.json");
		writeFileSync(
			source,
			JSON.stringify({
				version: 3,
				namedLocations: {
					"Greater Manchester": {
						memberCodes: ["E08000002", "E08000001", "E08000001"],
						bbox: [-2.5, 53.3, -2, 53.7],
					},
					"Example wards": {
						memberGeography: "ward",
						memberCodes: ["E05000001"],
						bbox: [-2.5, 53.3, -2, 53.7],
					},
				},
			}),
		);

		const inventory = compileNamedLocations(source);
		assert.equal(inventory.schemaVersion, 1);
		assert.equal(inventory.source.gazetteerVersion, 3);
		assert.deepEqual(inventory.locations, [
			{
				id: "example-wards",
				label: "Example wards",
				kind: "editorial-grouping",
				memberGeography: "ward",
				memberCodes: ["E05000001"],
				bbox: [-2.5, 53.3, -2, 53.7],
			},
			{
				id: "greater-manchester",
				label: "Greater Manchester",
				kind: "editorial-grouping",
				memberGeography: "localAuthority",
				memberCodes: ["E08000001", "E08000002"],
				bbox: [-2.5, 53.3, -2, 53.7],
			},
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
