import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { compileNamedLocations, membersAt } from "../src/namedLocations";

test("keeps an official area's kind and its ONS source", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-named-locations-"));
	try {
		const source = join(root, "gazetteer.core.json");
		writeFileSync(
			source,
			JSON.stringify({
				version: 1,
				namedLocations: {
					"South East": {
						kind: "region",
						source: {
							lookup: "local-authority-to-region/2025-04-en",
							code: "E12000008",
						},
						definitionRevision: 2,
						memberCodes: ["E07000229"],
						bbox: [-1.9, 50.5, 1.5, 52.2],
					},
					"Central Belt": {
						kind: "editorial",
						memberCodes: ["S12000049"],
						bbox: [-4.8, 55.6, -2.8, 56.1],
					},
				},
			}),
		);

		const [centralBelt, southEast] =
			compileNamedLocations(source).locations;
		assert.equal(centralBelt?.kind, "editorial-grouping");
		assert.equal(centralBelt?.source, undefined);
		assert.equal(southEast?.kind, "region");
		assert.equal(southEast?.definitionRevision, 2);
		assert.deepEqual(southEast?.source, {
			publisher: "Office for National Statistics",
			lookup: "local-authority-to-region/2025-04-en",
			code: "E12000008",
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("rejects a kind the gazetteer does not define", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-named-locations-"));
	try {
		const source = join(root, "gazetteer.core.json");
		writeFileSync(
			source,
			JSON.stringify({
				version: 1,
				namedLocations: {
					Somewhere: {
						kind: "parish",
						memberCodes: ["E07000229"],
						bbox: [0, 0, 1, 1],
					},
				},
			}),
		);
		assert.throws(() => compileNamedLocations(source), /Somewhere/);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

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
				memberAssertions: [
					{
						code: "E05000001",
						validity: { from: "2024-05-02", to: "2026-05-06" },
					},
				],
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
				memberAssertions: [
					{
						code: "E08000001",
						validity: { from: null, to: null },
					},
					{
						code: "E08000002",
						validity: { from: null, to: null },
					},
				],
				memberCodes: ["E08000001", "E08000002"],
				validity: { from: null, to: null },
				bbox: [-2.5, 53.3, -2, 53.7],
			},
		]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("selects dated member assertions using half-open intervals", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-named-locations-"));
	try {
		const source = join(root, "gazetteer.core.json");
		writeFileSync(
			source,
			JSON.stringify({
				version: 1,
				namedLocations: {
					"North West": {
						memberCodes: ["E07000026", "E06000063"],
						memberAssertions: [
							{ code: "E07000026", validTo: "2023-04-01" },
							{ code: "E06000063", validFrom: "2023-04-01" },
						],
						bbox: [-3.6, 53.3, -2.1, 55.1],
					},
				},
			}),
		);

		const [northWest] = compileNamedLocations(source).locations;
		assert.deepEqual(membersAt(northWest!, "2023-03-31"), ["E07000026"]);
		assert.deepEqual(membersAt(northWest!, "2023-04-01"), ["E06000063"]);
		assert.deepEqual(membersAt(northWest!), ["E06000063", "E07000026"]);
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
