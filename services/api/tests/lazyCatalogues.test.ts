import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readAreaLookup } from "../src/boundaryLoader";
import { readNamedLocationInventory } from "../src/locationLoader";
import { packNamedLocations } from "../src/namedLocationStorage";
import type { AreaInventory } from "../src/areaInventory";
import type { NamedLocationInventory } from "../src/namedLocations";

const fixture = (run: (root: string, directory: string) => void) => {
	const root = mkdtempSync(join(tmpdir(), "lazy-catalogues-"));
	const directory = join(root, "public");
	mkdirSync(directory);
	try {
		run(root, directory);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

test("area release keys are available before any records are parsed", () =>
	fixture((root, directory) => {
		const inventory: AreaInventory = {
			schemaVersion: 1,
			contentHash: "inventory",
			boundaryRegistryHash: "registry",
			releases: ["2023", "2024"].map((id) => ({
				id,
				geography: "ward",
				status: "available",
				recordCount: 1,
				artifact: `${id}.json`,
				contentHash: id,
				codeProperty: "code",
				nameProperty: "name",
			})),
		};
		for (const id of ["2023", "2024"])
			writeFileSync(
				join(directory, `${id}.json`),
				JSON.stringify({
					schemaVersion: 1,
					contentHash: id,
					areas: [{ code: "E00000001", name: `Ward ${id}` }],
				}),
			);
		const lookup = readAreaLookup(root, inventory);
		assert.deepEqual([...lookup.keys()], ["ward/2023", "ward/2024"]);
		rmSync(join(directory, "2023.json"));
		assert.deepEqual(lookup.get("ward/2024")?.get("E00000001"), {
			code: "E00000001",
			name: "Ward 2024",
		});
		assert.throws(() => lookup.get("ward/2023"), /ENOENT/);
		assert.equal(lookup.get("unknown"), undefined);
	}));

test("area releases stay parsed until their records exceed the budget", () =>
	fixture((root, directory) => {
		const ids = ["2022", "2023", "2024"];
		const inventory: AreaInventory = {
			schemaVersion: 1,
			contentHash: "inventory",
			boundaryRegistryHash: "registry",
			releases: ids.map((id) => ({
				id,
				geography: "ward",
				status: "available",
				recordCount: 2,
				artifact: `${id}.json`,
				contentHash: id,
				codeProperty: "code",
				nameProperty: "name",
			})),
		};
		for (const id of ids)
			writeFileSync(
				join(directory, `${id}.json`),
				JSON.stringify({
					schemaVersion: 1,
					contentHash: id,
					areas: [
						{ code: "E00000001", name: `Ward A ${id}` },
						{ code: "E00000002", name: `Ward B ${id}` },
					],
				}),
			);
		const lookup = readAreaLookup(root, inventory, 4);
		lookup.get("ward/2022");
		lookup.get("ward/2023");
		lookup.get("ward/2022");
		lookup.get("ward/2024");
		for (const id of ids) rmSync(join(directory, `${id}.json`));
		// 2023 was least recently used, so reading 2024 evicted it.
		assert.equal(lookup.get("ward/2022")?.size, 2);
		assert.equal(lookup.get("ward/2024")?.size, 2);
		assert.throws(() => lookup.get("ward/2023"), /ENOENT/);
	}));

test("packed named locations read geometry only when requested", () =>
	fixture((root, directory) => {
		const inventory: NamedLocationInventory = {
			schemaVersion: 1,
			contentHash: "locations",
			source: {
				artifact: "data/datasets/gazetteer.core.json",
				gazetteerVersion: 1,
			},
			locations: [
				{
					id: "test",
					label: "Test",
					kind: "editorial-grouping",
					definitionRevision: 1,
					memberGeography: "ward",
					memberCodes: ["E00000001"],
					validity: { from: null, to: null },
					bbox: [0, 0, 1, 1],
					geometry: {
						boundaryRelease: "2024",
						bbox: [0, 0, 1, 1],
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[0, 0],
									[1, 0],
									[0, 1],
									[0, 0],
								],
							],
						},
					},
				},
			],
		};
		packNamedLocations(directory, inventory);
		const loaded = readNamedLocationInventory(root);
		assert.equal(loaded.locations[0]?.label, "Test");
		assert.deepEqual(
			loaded.locations[0]?.geometry,
			inventory.locations[0]?.geometry,
		);
		const cold = readNamedLocationInventory(root);
		rmSync(join(directory, "location-geometries"), { recursive: true });
		assert.equal(cold.locations[0]?.label, "Test");
		assert.throws(() => cold.locations[0]?.geometry, /ENOENT/);
	}));
