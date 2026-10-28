import { DatabaseSync } from "node:sqlite";
import { areaTables } from "@uk-data-atlas/atlas-runtime/storage";
import { writeSqliteIndex } from "@uk-data-atlas/atlas-runtime/storage";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { validateBatch } from "@uk-data-atlas/atlas-runtime/api";
import { readAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import { readNamedLocationInventory } from "@uk-data-atlas/atlas-runtime/places";
import { namedLocationTables } from "@uk-data-atlas/atlas-runtime/storage";
import type { AreaInventory } from "../src/areaInventory";
import type { NamedLocationInventory } from "@uk-data-atlas/atlas-runtime/places";
import { artifactDirectory } from "@uk-data-atlas/atlas-runtime/storage";

const storeAreas = (
	apiRoot: string,
	directory: string,
	inventory: AreaInventory,
) => {
	writeFileSync(
		join(directory, "area-inventory.json"),
		JSON.stringify(inventory),
	);
	const compiled = join(apiRoot, "../../data/build");
	mkdirSync(compiled, { recursive: true });
	writeSqliteIndex(join(compiled, "atlas.sqlite"), {}, areaTables(directory));
};

const fixture = (run: (root: string, directory: string) => void) => {
	const root = mkdtempSync(join(tmpdir(), "lazy-catalogues-"));
	const directory = artifactDirectory(root);
	mkdirSync(directory, { recursive: true });
	try {
		run(join(root, "services/api"), directory);
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
		storeAreas(root, directory, inventory);
		const lookup = readAreaLookup(root, inventory);
		assert.deepEqual([...lookup.keys()], ["ward/2023", "ward/2024"]);
		rmSync(join(directory, "2023.json"));
		assert.deepEqual(lookup.get("ward/2024")?.get("E00000001"), {
			code: "E00000001",
			name: "Ward 2024",
		});
		assert.equal(lookup.get("ward/2023")?.size, 1);
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
		storeAreas(root, directory, inventory);
		const lookup = readAreaLookup(root, inventory, 4);
		lookup.get("ward/2022");
		lookup.get("ward/2023");
		lookup.get("ward/2022");
		lookup.get("ward/2024");
		const database = new DatabaseSync(
			join(root, "../../data/build/atlas.sqlite"),
		);
		database
			.prepare(
				"DELETE FROM areas WHERE releasePosition IN (SELECT position FROM area_releases WHERE id = ?)",
			)
			.run("2023");
		database.close();
		// 2023 was least recently used, so reading 2024 evicted it.
		assert.equal(lookup.get("ward/2022")?.size, 2);
		assert.equal(lookup.get("ward/2024")?.size, 2);
		assert.throws(() => lookup.get("ward/2023"), /Invalid area release/);
	}));

test("matching names in one geography never parses another's releases", () =>
	fixture((root, directory) => {
		const releases = [
			["ward", "2023"],
			["ward", "2024"],
			["parish", "2024"],
		] as const;
		const inventory: AreaInventory = {
			schemaVersion: 1,
			contentHash: "inventory",
			boundaryRegistryHash: "registry",
			releases: releases.map(([geography, id]) => ({
				id,
				geography,
				status: "available",
				recordCount: 1,
				artifact: `${geography}-${id}.json`,
				contentHash: `${geography}-${id}`,
				codeProperty: "code",
				nameProperty: "name",
			})),
		};
		for (const [geography, id] of releases)
			writeFileSync(
				join(directory, `${geography}-${id}.json`),
				JSON.stringify({
					schemaVersion: 1,
					contentHash: `${geography}-${id}`,
					areas: [
						{
							code: id === "2023" ? "E05000001" : "E05000002",
							name: id === "2023" ? "Old Ward" : "New Ward",
						},
					],
				}),
			);
		storeAreas(root, directory, inventory);
		const lookup = readAreaLookup(root, inventory);
		rmSync(join(directory, "parish-2024.json"));
		const [result] = validateBatch(lookup, "ward", "2024", ["Old Ward"]);
		assert.equal(result?.status, "unmatched");
		assert.deepEqual(
			result && "matchesIn" in result ? result.matchesIn : undefined,
			["2023"],
		);
	}));

test("SQLite named locations preserve membership rows and load geometry only when requested", () =>
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
		inventory.locations[0]!.memberAssertions = [
			{ code: "E00000001", validity: { from: "2024-01-01", to: null } },
		];
		inventory.locations[0]!.partialMembers = [
			{ code: "E00000002", share: 0, memberOf: "test" },
		];
		inventory.locations.push({
			id: "empty",
			label: "Empty",
			kind: "editorial-grouping",
			definitionRevision: 1,
			memberGeography: "ward",
			memberCodes: [],
			memberAssertions: [],
			partialMembers: [],
			validity: { from: null, to: null },
			bbox: [0, 0, 0, 0],
		});
		writeFileSync(
			join(directory, "named-locations.json"),
			JSON.stringify(inventory),
		);
		const compiled = join(root, "../../data/build");
		mkdirSync(compiled, { recursive: true });
		const path = join(compiled, "atlas.sqlite");
		writeSqliteIndex(path, {}, namedLocationTables(directory));
		rmSync(join(directory, "named-locations.json"));
		const loaded = readNamedLocationInventory(root);
		assert.equal(JSON.stringify(loaded), JSON.stringify(inventory));
		assert.equal(loaded.locations[0]?.label, "Test");
		assert.deepEqual(
			loaded.locations[0]?.geometry,
			inventory.locations[0]?.geometry,
		);
		const cold = readNamedLocationInventory(root);
		const stale = readNamedLocationInventory(root);
		const database = new DatabaseSync(path);
		assert.deepEqual(
			database.prepare("PRAGMA foreign_key_check").all(),
			[],
		);
		assert.equal(
			database
				.prepare("SELECT share FROM named_location_partial_members")
				.get()?.share,
			0,
		);
		assert.throws(
			() => database.prepare("DELETE FROM named_locations").run(),
			/FOREIGN KEY/,
		);
		database
			.prepare(
				"UPDATE named_location_inventory SET contentHash = 'new-release'",
			)
			.run();
		assert.throws(
			() => stale.locations[0]?.geometry,
			/Missing named location geometry/,
		);
		database
			.prepare(
				"UPDATE named_location_inventory SET contentHash = 'locations'",
			)
			.run();
		database.prepare("DELETE FROM named_location_geometries").run();
		database.close();
		assert.equal(cold.locations[0]?.label, "Test");
		assert.throws(
			() => cold.locations[0]?.geometry,
			/Missing named location geometry/,
		);
	}));
