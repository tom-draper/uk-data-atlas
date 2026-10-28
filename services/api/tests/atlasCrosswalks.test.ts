import {
	areaTables,
	readSqliteAreas,
} from "@uk-data-atlas/atlas-runtime/storage";
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
import { crosswalkTables } from "@uk-data-atlas/atlas-runtime/storage";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
} from "@uk-data-atlas/atlas-runtime/relationships";
import { writeSqliteIndex } from "@uk-data-atlas/atlas-runtime/storage";
import { crosswalkArtifact, crosswalkInventory } from "./routeFixtures";
import { artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";

test("crosswalk edges rebuild artifacts with zero weights, labels and empty targets", (context) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-crosswalks-"));
	context.after(() => rmSync(root, { recursive: true, force: true }));
	const apiRoot = join(root, "services/api");
	const directory = join(artifactRoot(apiRoot), "crosswalks");
	mkdirSync(directory, { recursive: true });
	mkdirSync(join(root, "data/build"), { recursive: true });
	const weighting = {
		status: "provided",
		basis: "population",
		normalisation: "per-source",
		population: "Census 2021 usual residents",
		date: "2021-03-21",
		blocks: { geography: "lsoa", boundaryRelease: "2021" },
	} as const;
	const records = [
		{
			source: { code: "A", labels: [], population: 3, coverage: 0 },
			targets: [],
		},
		{
			source: {
				code: "B",
				labels: ["B", "Bee"],
				population: 5,
				coverage: 1,
			},
			targets: [
				{
					code: "X",
					labels: ["X"],
					weight: 1,
					population: 5,
					overlapAreaM2: 10,
				},
				{
					code: "Y",
					labels: [],
					weight: 0,
					population: 0,
					sourceShare: 0,
					targetShare: 0,
					overlapAreaM2: 0,
				},
			],
		},
	];
	const artifact = { ...crosswalkArtifact, weighting, records };
	const artifacts = [
		artifact,
		{
			...crosswalkArtifact,
			id: "another-crosswalk",
			records: [
				{ source: { code: "A2", labels: [] }, targets: [] },
				{
					source: { code: "B", labels: ["different"] },
					targets: [{ code: "Y", labels: [], change: "split" }],
				},
			],
		},
	];
	const inventory = {
		...crosswalkInventory,
		crosswalks: artifacts.map((value) => ({
			...crosswalkInventory.crosswalks[0],
			id: value.id,
			weighting: value.weighting,
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
	const rebuild = () =>
		writeSqliteIndex(
			path,
			{},
			{
				...areaTables(artifactRoot(apiRoot)),
				...crosswalkTables(artifactRoot(apiRoot)),
			},
		);
	rebuild();
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
		const all = (sql: string) =>
			database
				.prepare(sql)
				.all()
				.map((row) => Object.values(row));
		assert.deepEqual(
			all(
				"SELECT crosswalk, from_code, to_code, change, basis, weight, overlap, source_share FROM v_crosswalk_edge ORDER BY crosswalk, from_code, to_code",
			),
			[
				[
					"another-crosswalk",
					"B",
					"Y",
					"split",
					null,
					null,
					null,
					null,
				],
				[
					"constituency-2010-to-2024",
					"B",
					"X",
					null,
					"population",
					1,
					5,
					null,
				],
				[
					"constituency-2010-to-2024",
					"B",
					"Y",
					null,
					"population",
					0,
					0,
					0,
				],
			],
		);
		// Overlap area is a check on a population-weighted crosswalk.
		assert.deepEqual(
			all(
				"SELECT overlap_area_m2 FROM crosswalk_edge_check ORDER BY to_version_id",
			),
			[[10], [0]],
		);
		// Sources are stored only for coverage or an empty target list.
		assert.deepEqual(
			all(
				"SELECT c.slug, a.code, s.coverage FROM crosswalk_source s JOIN crosswalk c ON c.id = s.crosswalk_id JOIN area_version v ON v.id = s.from_version_id JOIN area a ON a.id = v.area_id ORDER BY 1, 2",
			),
			[
				["another-crosswalk", "A2", null],
				["constituency-2010-to-2024", "A", 0],
				["constituency-2010-to-2024", "B", 1],
			],
		);
		// Labels are stored only where they differ from the area's names.
		assert.deepEqual(
			all(
				"SELECT c.slug, a.code, l.labels FROM crosswalk_label l JOIN crosswalk c ON c.id = l.crosswalk_id JOIN area_version v ON v.id = l.area_version_id JOIN area a ON a.id = v.area_id ORDER BY 1, 2",
			),
			[
				["another-crosswalk", "A2", "[]"],
				["another-crosswalk", "B", '["different"]'],
				["another-crosswalk", "Y", "[]"],
				["constituency-2010-to-2024", "A", "[]"],
				["constituency-2010-to-2024", "Y", "[]"],
			],
		);
		assert.deepEqual(
			all("SELECT code, population FROM areas ORDER BY id"),
			[
				["B", 5],
				["A", 3],
				["X", null],
				["Y", null],
				["A2", null],
			],
		);
		assert.throws(
			() =>
				database
					.prepare(
						"UPDATE crosswalk_edge SET to_version_id = -1 WHERE crosswalk_id = 1",
					)
					.run(),
			/FOREIGN KEY/,
		);
		assert.throws(
			() => database.prepare("DELETE FROM crosswalk_edge").run(),
			/FOREIGN KEY/,
		);
		assert.throws(
			() =>
				database
					.prepare("UPDATE crosswalk_weight SET basis_id = 'unknown'")
					.run(),
			/FOREIGN KEY/,
		);
		assert.deepEqual(
			database.prepare("PRAGMA foreign_key_check").all(),
			[],
		);
	} finally {
		database.close();
	}
	const before = readFileSync(path);
	const refuse = (value: object, message: RegExp) => {
		writeFileSync(input, JSON.stringify(value));
		assert.throws(rebuild, message);
		assert.deepEqual(readFileSync(path), before);
	};
	const withSource = (source: object) => ({
		...artifact,
		records: [records[0], { ...records[1], source }],
	});
	for (const [source, message] of [
		[
			{ code: "B", labels: [123], population: 5, coverage: 1 },
			/Invalid crosswalk area/,
		],
		[
			{
				code: "B",
				labels: ["B"],
				population: 5,
				coverage: 1,
				unknown: 1,
			},
			/sources do not all give the same fields/,
		],
	] as const)
		refuse(withSource(source), message);
	// Another crosswalk giving the same source a different population.
	writeFileSync(input, JSON.stringify(artifact));
	const other = join(directory, `${artifacts[1].id}.json`);
	writeFileSync(
		other,
		JSON.stringify({
			...artifacts[1],
			records: [
				{
					source: { code: "A2", labels: [], population: 1 },
					targets: [],
				},
				{
					source: { code: "B", labels: ["B"], population: 6 },
					targets: [],
				},
			],
		}),
	);
	assert.throws(rebuild, /Conflicting crosswalk area fact/);
	assert.deepEqual(readFileSync(path), before);
	writeFileSync(other, JSON.stringify(artifacts[1]));
	refuse(
		{ ...artifact, records: [records[1], records[0]] },
		/not in source code order/,
	);
	refuse(
		{
			...artifact,
			records: [
				records[0],
				{ ...records[1], targets: [...records[1].targets].reverse() },
			],
		},
		/not in code order/,
	);
	refuse(
		{
			...artifact,
			records: [
				records[0],
				{
					...records[1],
					targets: [
						{ code: "X", weight: 1, labels: ["X"] },
						records[1].targets[1],
					],
				},
			],
		},
		/endpoint fields out of order/,
	);
	refuse(
		{
			...artifact,
			records: [
				records[0],
				{
					...records[1],
					targets: [{ code: "X", labels: ["X"], population: 5 }],
				},
			],
		},
		/target without a weight/,
	);
	writeFileSync(input, JSON.stringify(artifact));
	writeFileSync(
		areaInventoryPath,
		JSON.stringify({ ...areaInventory, releases: [] }),
	);
	assert.throws(rebuild, /Missing crosswalk area release/);
	writeFileSync(areaInventoryPath, JSON.stringify(areaInventory));
	refuse({ ...artifact, contentHash: "stale" }, /Invalid crosswalk artifact/);
	rmSync(artifactRoot(apiRoot), { recursive: true });
	assert.equal(
		JSON.stringify(
			readCrosswalkLookup(apiRoot, inventory).get(artifact.id),
		),
		JSON.stringify(artifact),
	);
});
