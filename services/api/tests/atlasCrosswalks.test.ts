import { areaTables, readSqliteAreas } from "../src/atlasAreas";
import { emptyCrosswalkAreas } from "./helpers/sqliteAreas";
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
import { artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";

test("relational crosswalk rows preserve endpoint order, zero weights and empty targets", (context) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-crosswalks-"));
	context.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	const directory = join(artifactRoot(apiRoot), "crosswalks");
	mkdirSync(directory, { recursive: true });
	mkdirSync(join(root, "data/build"), { recursive: true });
	const records = [
		{
			source: {
				code: "B",
				labels: ["B", "Bee"],
				population: 5,
				areaM2: 10,
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
		join(artifactRoot(apiRoot), "crosswalk-inventory.json"),
		JSON.stringify(inventory),
	);
	const input = join(directory, `${artifact.id}.json`);
	for (const value of artifacts)
		writeFileSync(
			join(directory, `${value.id}.json`),
			JSON.stringify(value),
		);
	emptyCrosswalkAreas(artifactRoot(apiRoot), inventory);
	const areaInventoryPath = join(
		artifactRoot(apiRoot),
		"area-inventory.json",
	);
	const areaInventory = JSON.parse(readFileSync(areaInventoryPath, "utf8"));
	areaInventory.releases[0] = {
		...areaInventory.releases[0],
		status: "available",
		artifact: "source-areas.json",
		contentHash: "source-areas",
		recordCount: 1,
		codeProperty: "code",
		nameProperty: "name",
	};
	writeFileSync(areaInventoryPath, JSON.stringify(areaInventory));
	writeFileSync(
		join(artifactRoot(apiRoot), "source-areas.json"),
		JSON.stringify({
			schemaVersion: 1,
			contentHash: "source-areas",
			areas: [{ code: "B", name: "B", aliases: ["Bee"] }],
		}),
	);
	const path = join(root, "data/build/atlas.sqlite");
	writeSqliteIndex(
		path,
		{},
		{
			...areaTables(artifactRoot(apiRoot)),
			...crosswalkTables(artifactRoot(apiRoot)),
		},
	);
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
	assert.deepEqual(readSqliteAreas(apiRoot, areaInventory.releases[0]), [
		{ code: "B", name: "B", aliases: ["Bee"] },
	]);
	const database = new DatabaseSync(path);
	try {
		assert.equal(
			database
				.prepare(
					"SELECT weight FROM crosswalk_targets_decoded WHERE code = 'Y' AND crosswalkId = ?",
				)
				.get(artifact.id)?.weight,
			0,
		);
		assert.equal(
			database
				.prepare("SELECT count(*) AS n FROM areas WHERE code = 'B'")
				.get()?.n,
			1,
		);
		assert.equal(
			database
				.prepare("SELECT population FROM areas WHERE code = 'B'")
				.get()?.population,
			5,
		);
		assert.deepEqual(
			database
				.prepare(
					"SELECT labelsId FROM crosswalk_sources WHERE position = 0 ORDER BY crosswalkPosition",
				)
				.all()
				.map((row) => row.labelsId === null),
			[true, false],
		);
		assert.ok(
			!database
				.prepare("PRAGMA table_info(crosswalk_sources)")
				.all()
				.some((row) =>
					["code", "labels", "areaM2", "population"].includes(
						row.name as string,
					),
				),
		);
		assert.throws(
			() =>
				database
					.prepare("UPDATE crosswalk_sources SET areaId = -1")
					.run(),
			/FOREIGN KEY/,
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
					"SELECT count(*) AS n FROM crosswalk_sources WHERE typeof(crosswalkPosition) != 'integer' OR typeof(fieldSetId) != 'integer' OR typeof(areaId) != 'integer'",
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
	const otherInput = join(directory, `${artifacts[1].id}.json`);
	const rebuild = () =>
		writeSqliteIndex(
			path,
			{},
			{
				...areaTables(artifactRoot(apiRoot)),
				...crosswalkTables(artifactRoot(apiRoot)),
			},
		);
	for (const [source, message] of [
		[
			{ code: "B", labels: ["B"], population: 6 },
			/Conflicting crosswalk area fact/,
		],
		[
			{ code: "B", labels: ["B"], areaM2: 11 },
			/Conflicting crosswalk area fact/,
		],
		[{ code: "B", labels: [123] }, /Invalid crosswalk area/],
		[
			{ code: "B", labels: ["B"], unknown: 1 },
			/Unknown crosswalk endpoint field/,
		],
	] as const) {
		writeFileSync(
			otherInput,
			JSON.stringify({
				...artifacts[1],
				records: [{ source, targets: [] }, artifacts[1].records[1]],
			}),
		);
		assert.throws(rebuild, message);
		assert.deepEqual(readFileSync(path), before);
	}
	writeFileSync(otherInput, JSON.stringify(artifacts[1]));
	writeFileSync(
		areaInventoryPath,
		JSON.stringify({ ...areaInventory, releases: [] }),
	);
	assert.throws(rebuild, /Missing crosswalk area release/);
	writeFileSync(areaInventoryPath, JSON.stringify(areaInventory));
	writeFileSync(input, JSON.stringify({ ...artifact, contentHash: "stale" }));
	assert.throws(
		() =>
			writeSqliteIndex(
				path,
				{},
				{
					...areaTables(artifactRoot(apiRoot)),
					...crosswalkTables(artifactRoot(apiRoot)),
				},
			),
		/Invalid crosswalk artifact/,
	);
	assert.deepEqual(readFileSync(path), before);
	rmSync(artifactRoot(apiRoot), { recursive: true });
	assert.equal(
		JSON.stringify(
			readCrosswalkLookup(apiRoot, inventory).get(artifact.id),
		),
		JSON.stringify(artifact),
	);
});
