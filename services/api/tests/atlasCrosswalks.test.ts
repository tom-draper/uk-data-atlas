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
	const artifacts = [
		artifact,
		{
			...artifact,
			id: "another-crosswalk",
			records: [
				{
					source: { labels: ["different"], code: "B", coverage: 0 },
					targets: [{ weight: 0, code: "Y", labels: [] }],
				},
				{ source: { code: "A2", labels: [] }, targets: [] },
			],
		},
	];
	const inventory = {
		...crosswalkInventory,
		crosswalks: artifacts.map((value) => ({
			...crosswalkInventory.crosswalks[0],
			id: value.id,
			recordCount: value.records.length,
			artifact: `crosswalks/${value.id}.json`,
		})),
	};
	writeFileSync(
		join(apiRoot, "public/crosswalk-inventory.json"),
		JSON.stringify(inventory),
	);
	const input = join(directory, `${artifact.id}.json`);
	for (const value of artifacts)
		writeFileSync(
			join(directory, `${value.id}.json`),
			JSON.stringify(value),
		);
	const path = join(root, "data/build/atlas.sqlite");
	writeSqliteIndex(path, {}, crosswalkTables(join(apiRoot, "public")));
	assert.equal(
		JSON.stringify(readCrosswalkInventory(apiRoot)),
		JSON.stringify(inventory),
	);
	for (const value of artifacts)
		assert.equal(
			JSON.stringify(
				readCrosswalkLookup(apiRoot, inventory).get(value.id),
			),
			JSON.stringify(value),
		);
	const database = new DatabaseSync(path);
	try {
		assert.equal(
			database
				.prepare(
					"SELECT weight FROM crosswalk_targets WHERE code = 'Y' AND crosswalkPosition = 0",
				)
				.get()?.weight,
			0,
		);
		const fieldSets = new Set(
			artifacts.flatMap((value) =>
				value.records.flatMap((record) =>
					[record.source, ...record.targets].map((endpoint) =>
						JSON.stringify(Object.keys(endpoint)),
					),
				),
			),
		);
		assert.ok(
			fieldSets.size <
				artifacts.flatMap((value) =>
					value.records.flatMap((record) => [
						record.source,
						...record.targets,
					]),
				).length,
		);
		assert.equal(
			database
				.prepare("SELECT count(*) AS n FROM crosswalk_field_sets")
				.get()?.n,
			fieldSets.size,
		);
		assert.equal(
			database
				.prepare(
					"SELECT count(*) AS n FROM crosswalk_sources WHERE typeof(crosswalkPosition) != 'integer' OR typeof(fieldSetId) != 'integer'",
				)
				.get()?.n,
			0,
		);
		for (const value of artifacts) {
			assert.deepEqual(
				database
					.prepare(
						"SELECT fields FROM crosswalk_sources_decoded WHERE crosswalkId = ? ORDER BY position",
					)
					.all(value.id)
					.map((row) => row.fields),
				value.records.map((record) =>
					JSON.stringify(Object.keys(record.source)),
				),
			);
			assert.deepEqual(
				database
					.prepare(
						"SELECT fields FROM crosswalk_targets_decoded WHERE crosswalkId = ? ORDER BY sourcePosition, position",
					)
					.all(value.id)
					.map((row) => row.fields),
				value.records.flatMap((record) =>
					record.targets.map((target) =>
						JSON.stringify(Object.keys(target)),
					),
				),
			);
		}
		assert.throws(
			() =>
				database
					.prepare("UPDATE crosswalk_sources SET fieldSetId = -1")
					.run(),
			/FOREIGN KEY/,
		);
		assert.throws(
			() =>
				database
					.prepare(
						"UPDATE crosswalk_sources SET crosswalkPosition = -1 WHERE crosswalkPosition = 0",
					)
					.run(),
			/FOREIGN KEY/,
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
