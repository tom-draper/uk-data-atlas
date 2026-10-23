import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { crosswalkTables } from "../src/atlasCrosswalks";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
} from "../src/crosswalkLoader";
import { writeSqliteIndex } from "../src/sqliteIndex";
import { crosswalkArtifact, crosswalkInventory } from "./routeFixtures";

test("relational crosswalk rows preserve endpoint order, zero weights and empty targets", (context) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-crosswalks-"));
	context.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	const directory = join(apiRoot, "public/crosswalks");
	mkdirSync(directory, { recursive: true });
	mkdirSync(join(root, "data/build"), { recursive: true });
	const records = [
		{
			source: {
				code: "B",
				labels: ["B", "Bee"],
				population: 5,
				coverage: 1,
			},
			targets: [
				{
					code: "Y",
					labels: [],
					weight: 0,
					population: 0,
					sourceShare: 0,
					targetShare: 0,
					overlapAreaM2: 0,
				},
				{
					code: "X",
					weight: 1,
					labels: ["X"],
					population: 5,
					overlapAreaM2: 10,
				},
			],
		},
		{ source: { code: "A", labels: [] }, targets: [] },
	];
	const artifact = { ...crosswalkArtifact, records };
	const inventory = {
		...crosswalkInventory,
		crosswalks: crosswalkInventory.crosswalks.map((row) => ({
			...row,
			recordCount: records.length,
		})),
	};
	writeFileSync(
		join(apiRoot, "public/crosswalk-inventory.json"),
		JSON.stringify(inventory),
	);
	const input = join(directory, `${artifact.id}.json`);
	writeFileSync(input, JSON.stringify(artifact));
	const path = join(root, "data/build/atlas.sqlite");
	writeSqliteIndex(path, {}, crosswalkTables(join(apiRoot, "public")));
	assert.equal(
		JSON.stringify(readCrosswalkInventory(apiRoot)),
		JSON.stringify(inventory),
	);
	assert.equal(
		JSON.stringify(
			readCrosswalkLookup(apiRoot, inventory).get(artifact.id),
		),
		JSON.stringify(artifact),
	);
	const database = new DatabaseSync(path);
	try {
		assert.equal(
			database
				.prepare(
					"SELECT weight FROM crosswalk_targets WHERE code = 'Y'",
				)
				.get()?.weight,
			0,
		);
		assert.deepEqual(
			database.prepare("PRAGMA foreign_key_check").all(),
			[],
		);
		assert.throws(
			() => database.prepare("DELETE FROM crosswalk_sources").run(),
			/FOREIGN KEY/,
		);
	} finally {
		database.close();
	}
	const before = readFileSync(path);
	writeFileSync(input, JSON.stringify({ ...artifact, contentHash: "stale" }));
	assert.throws(
		() =>
			writeSqliteIndex(
				path,
				{},
				crosswalkTables(join(apiRoot, "public")),
			),
		/Invalid crosswalk artifact/,
	);
	assert.deepEqual(readFileSync(path), before);
	rmSync(join(apiRoot, "public"), { recursive: true });
	assert.equal(
		JSON.stringify(
			readCrosswalkLookup(apiRoot, inventory).get(artifact.id),
		),
		JSON.stringify(artifact),
	);
});
