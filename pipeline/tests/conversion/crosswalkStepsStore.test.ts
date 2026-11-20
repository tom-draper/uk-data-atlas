import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import {
	buildStep,
	readCrosswalks,
	weightTablesOf,
} from "../../src/conversion/crosswalkSteps.ts";

/** The columns of the atlas tables that a step reads, and only those. */
const atlasWithOneWeightTable = () => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE crosswalk (id INTEGER PRIMARY KEY, slug TEXT, method TEXT, purpose TEXT, from_release_id INTEGER, to_release_id INTEGER);
		CREATE TABLE crosswalk_edge (crosswalk_id INTEGER, from_version_id INTEGER, to_version_id INTEGER, change TEXT, relation TEXT);
		CREATE TABLE crosswalk_weight (crosswalk_id INTEGER, from_version_id INTEGER, to_version_id INTEGER, basis_id TEXT, weight REAL, source_share REAL);
		CREATE TABLE crosswalk_source (crosswalk_id INTEGER, from_version_id INTEGER, coverage REAL);
		INSERT INTO crosswalk VALUES (1, 'a-to-b', 'population-overlap', NULL, 1, 2);
		INSERT INTO crosswalk_edge VALUES (1, 10, 20, NULL, NULL), (1, 10, 21, NULL, NULL);
		INSERT INTO crosswalk_weight VALUES (1, 10, 20, 'population', 0.25, NULL), (1, 10, 21, 'population', 0.75, NULL);
	`);
	return database;
};

test("a step reads weights from a database whose only weight table is main", () => {
	const database = atlasWithOneWeightTable();
	assert.deepEqual(weightTablesOf(database), ["main.crosswalk_weight"]);
	const step = buildStep(database, readCrosswalks(database), "population");
	assert.deepEqual(
		step.edges.get(10)!.map((edge) => [edge.to, edge.weight]),
		[
			[20, 0.25],
			[21, 0.75],
		],
	);
});
