import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { areaTables } from "@uk-data-atlas/atlas-runtime/storage";
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
						"INSERT INTO areas VALUES (NULL, 0, 'A', 1, 'duplicate', NULL, NULL, NULL)",
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
						"INSERT INTO areas VALUES (NULL, -1, 'A', 1, 'name', NULL, NULL, NULL)",
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
