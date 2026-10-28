import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
	AREA_GEOGRAPHY_MISMATCH,
	addAreaVersion,
	areaTables,
} from "@uk-data-atlas/atlas-runtime/storage";
import {
	readAreaInventory,
	readAreaLookup,
} from "@uk-data-atlas/atlas-runtime/areas";
import type { AreaInventory } from "../src/areaInventory";
import { writeSqliteIndex } from "@uk-data-atlas/atlas-runtime/storage";
import { artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";

test("relational areas preserve inventory order, aliases and record order without JSON", (context) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-areas-"));
	context.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	const directory = artifactRoot(apiRoot);
	mkdirSync(directory, { recursive: true });
	mkdirSync(join(root, "data/build"), { recursive: true });
	const inventory: AreaInventory = {
		schemaVersion: 1,
		contentHash: "inventory",
		boundaryRegistryHash: "registry",
		releases: [
			{
				id: "2024",
				geography: "ward",
				status: "available",
				recordCount: 3,
				artifact: "ward.json",
				contentHash: "release",
				codeProperty: "code",
				nameProperty: "name",
			},
			{
				id: "2023",
				geography: "ward",
				status: "not-compiled",
				reason: "Missing source",
			},
		],
	};
	const areas = [
		{ code: "B", name: "Second", aliases: [] },
		{ code: "A", name: "First", aliases: ["Welsh", "Other"] },
		{ code: "C", name: "Third" },
	];
	writeFileSync(
		join(directory, "area-inventory.json"),
		JSON.stringify(inventory),
	);
	writeFileSync(
		join(directory, "ward.json"),
		JSON.stringify({ schemaVersion: 1, contentHash: "release", areas }),
	);
	const path = join(root, "data/build/atlas.sqlite");
	writeSqliteIndex(path, {}, areaTables(directory));
	rmSync(directory, { recursive: true });
	assert.equal(
		JSON.stringify(readAreaInventory(apiRoot)),
		JSON.stringify(inventory),
	);
	assert.equal(
		JSON.stringify([...readAreaLookup(apiRoot).get("ward/2024")!.values()]),
		JSON.stringify(areas),
	);
	const database = new DatabaseSync(path);
	try {
		assert.deepEqual(
			database
				.prepare("SELECT id, code FROM areas ORDER BY id")
				.all()
				.map((row) => ({ ...row })),
			areas.map((area, index) => ({ id: index + 1, code: area.code })),
		);
		assert.throws(
			() =>
				database
					.prepare(
						"INSERT INTO area_version VALUES (NULL, 1, 0, 'duplicate', NULL, NULL, NULL, 1)",
					)
					.run(),
			/UNIQUE/,
		);
		assert.deepEqual(
			database.prepare("PRAGMA foreign_key_check").all(),
			[],
		);
		assert.throws(
			() =>
				database
					.prepare(
						"INSERT INTO area_version VALUES (NULL, 1, -1, 'name', NULL, NULL, NULL, 1)",
					)
					.run(),
			/FOREIGN KEY/,
		);
		database
			.prepare("UPDATE area_releases SET contentHash = 'stale'")
			.run();
		assert.throws(
			() => readAreaLookup(apiRoot, inventory).get("ward/2024"),
			/Invalid area release/,
		);
		database.prepare("DELETE FROM area_inventory").run();
		assert.throws(
			() => readAreaInventory(apiRoot),
			/Invalid SQLite area inventory/,
		);
	} finally {
		database.close();
	}
});

test("an area keeps one identity across releases, with a version per release", (context) => {
	const directory = mkdtempSync(join(tmpdir(), "atlas-area-identity-"));
	context.after(() => rmSync(directory, { recursive: true, force: true }));
	const release = (geography: string, id: string, codes: string[]) => {
		const artifact = `${geography}-${id}.json`;
		writeFileSync(
			join(directory, artifact),
			JSON.stringify({
				schemaVersion: 1,
				contentHash: artifact,
				areas: codes.map((code) => ({ code, name: `${code} ${id}` })),
			}),
		);
		return {
			id,
			geography,
			status: "available" as const,
			recordCount: codes.length,
			artifact,
			contentHash: artifact,
			codeProperty: "code",
			nameProperty: "name",
		};
	};
	const inventory: AreaInventory = {
		schemaVersion: 1,
		contentHash: "inventory",
		boundaryRegistryHash: "registry",
		releases: [
			release("ward", "2023", ["A", "B"]),
			release("ward", "2024", ["B", "C"]),
			release("region", "2024", ["B"]),
		],
	};
	writeFileSync(
		join(directory, "area-inventory.json"),
		JSON.stringify(inventory),
	);
	const path = join(directory, "atlas.sqlite");
	writeSqliteIndex(path, {}, areaTables(directory));
	const database = new DatabaseSync(path);
	context.after(() => database.close());
	const versions = () =>
		database
			.prepare(
				"SELECT v.id, g.slug, a.code, v.area_id, v.release_id, v.in_inventory FROM area_version v JOIN area a ON a.id = v.area_id JOIN geography g ON g.id = a.geography_id ORDER BY v.id",
			)
			.all()
			.map((row) => Object.values(row));
	assert.deepEqual(versions(), [
		[1, "ward", "A", 1, 0, 1],
		[2, "ward", "B", 2, 0, 1],
		[3, "ward", "B", 2, 1, 1],
		[4, "ward", "C", 3, 1, 1],
		[5, "region", "B", 4, 2, 1],
	]);
	const add = addAreaVersion(database);
	add(1, "A", "", null);
	add(2, "D", "", null);
	assert.deepEqual(versions().slice(5), [
		[6, "ward", "A", 1, 1, 0],
		[7, "region", "D", 5, 2, 0],
	]);
	assert.throws(() => add(1, "A", "", null), /UNIQUE/);
	assert.throws(() => add(9, "E", "", null), /Missing area release/);
	assert.equal(database.prepare(AREA_GEOGRAPHY_MISMATCH).get()?.n, 0);
	assert.deepEqual(
		{
			...database
				.prepare(
					"SELECT * FROM areas WHERE releasePosition = 1 AND code = 'A'",
				)
				.get(),
		},
		{
			id: 6,
			releasePosition: 1,
			code: "A",
			inInventory: 0,
			name: "",
			aliases: null,
			areaM2: null,
			population: null,
		},
	);
	assert.throws(
		() => database.exec("UPDATE areas SET name = 'x'"),
		/cannot modify areas because it is a view/,
	);
});
