import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import { writeAreaHierarchy } from "../../src/storage/areaHierarchy.ts";

test("hierarchy keeps membership evidence and labels uncertain assignments", () => {
	const build = () => {
		const db = new DatabaseSync(":memory:");
		db.exec(`CREATE TABLE area_version(id INTEGER PRIMARY KEY);
		CREATE TABLE crosswalk(id INTEGER PRIMARY KEY, method TEXT, purpose TEXT);
		CREATE TABLE crosswalk_edge(crosswalk_id INTEGER, from_version_id INTEGER, to_version_id INTEGER);
		INSERT INTO area_version VALUES (1),(2),(3);
		INSERT INTO crosswalk VALUES (1,'clean-containment',NULL),(2,'best-fit',NULL),
		(3,'geometric-containment','membership'),(4,'official-lookup','membership'),
		(5,'official-lookup','identity'),(6,'area-overlap',NULL);
		INSERT INTO crosswalk_edge VALUES (1,1,2),(2,1,3),(3,1,3),(4,1,2),(5,1,2),(6,1,2);`);
		writeAreaHierarchy(db);
		const rows = db
			.prepare("SELECT * FROM area_hierarchy ORDER BY crosswalk_id")
			.all();
		assert.deepEqual(
			rows.map((row) => row.accuracy),
			["exact", "approximate", "approximate", "approximate"],
		);
		assert.equal(
			db
				.prepare(
					"SELECT count(*) AS n FROM area_hierarchy WHERE child_version_id = 1",
				)
				.get()!.n,
			4,
		);
		assert.equal(
			db
				.prepare(
					"SELECT count(*) AS n FROM area_hierarchy WHERE parent_version_id = 2",
				)
				.get()!.n,
			2,
		);
		assert.match(
			String(
				db
					.prepare(
						"EXPLAIN QUERY PLAN SELECT * FROM area_hierarchy WHERE parent_version_id = 2",
					)
					.get()!.detail,
			),
			/area_hierarchy_parent/,
		);
		db.close();
		return rows;
	};
	assert.deepEqual(build(), build());
});
