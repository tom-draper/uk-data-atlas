import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { areaTables } from "../src/atlasAreas";
import { readAreaInventory, readAreaLookup } from "../src/boundaryLoader";
import type { AreaInventory } from "../src/areaInventory";
import { writeSqliteIndex } from "../src/sqliteIndex";

test("relational areas preserve inventory order, aliases and record order without JSON", (context) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-areas-"));
	context.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	const directory = join(apiRoot, "public");
	mkdirSync(directory, { recursive: true });
	mkdirSync(join(root, "compiled"));
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
	const path = join(root, "compiled/atlas.sqlite");
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
			database.prepare("PRAGMA foreign_key_check").all(),
			[],
		);
		assert.throws(
			() =>
				database
					.prepare(
						"INSERT INTO areas VALUES ('missing', '2024', 'A', 0, 'name', NULL)",
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
