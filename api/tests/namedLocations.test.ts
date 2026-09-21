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
						definitionRevision: 4,
						memberGeography: "ward",
						memberCodes: ["E05000001"],
						validFrom: "2024-05-02",
						validTo: "2026-05-06",
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
				definitionRevision: 4,
				memberGeography: "ward",
				memberCodes: ["E05000001"],
				validity: { from: "2024-05-02", to: "2026-05-06" },
				bbox: [-2.5, 53.3, -2, 53.7],
			},
			{
				id: "greater-manchester",
				label: "Greater Manchester",
				kind: "editorial-grouping",
				definitionRevision: 3,
				memberGeography: "localAuthority",
				memberCodes: ["E08000001", "E08000002"],
				validity: { from: null, to: null },
				bbox: [-2.5, 53.3, -2, 53.7],
			},
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("refuses an invalid named-location revision or validity interval", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-named-locations-"));
	try {
		const source = join(root, "gazetteer.core.json");
		writeFileSync(
			source,
			JSON.stringify({
				version: 1,
				namedLocations: {
					Invalid: {
						definitionRevision: 0,
						memberCodes: ["E08000001"],
						validFrom: "2026-05-06",
						validTo: "2024-05-02",
						bbox: [-2.5, 53.3, -2, 53.7],
					},
				},
			}),
		);
		assert.throws(
			() => compileNamedLocations(source),
			/named location Invalid is invalid/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
