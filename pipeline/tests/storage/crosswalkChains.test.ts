import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "vitest";
import { IdRegistries } from "../../src/ids/idRegistries.ts";
import { writeCrosswalkChains } from "../../src/storage/crosswalkChains.ts";

const near = (actual: number, expected: number) =>
	assert.ok(
		Math.abs(actual - expected) < 1e-12,
		`${actual} is not ${expected}`,
	);

const BASES = ["population", "households", "dwellings", "postcodes"] as const;

/**
 * Wards in three releases (2011, 2018, 2026) and the columns a step reads.
 *
 * 2011: A and D. 2018: B and C. 2026: X and Y.
 * Crosswalk 1 (2011 to 2018, population-overlap): A is a quarter B and three
 * quarters C by residents, half and half on every other basis. D is all of C.
 * Crosswalk 2 (2018 to 2026, population-overlap): B is all of X, C is half X
 * and half Y on every basis.
 * Area E of 2011 is in no crosswalk. Area H of 2011 is half C and half G, and
 * G of 2018 is in no crosswalk. Area F is listed for 2011 but not in its
 * inventory.
 *
 * Local authorities in two releases joined by extent-continuity, so the chain
 * is exact. Constituencies in two releases with no crosswalk at all.
 */
const fixture = () => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE weight_basis (id TEXT PRIMARY KEY);
		CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT, inventory_position INTEGER);
		CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER, name TEXT, in_inventory INTEGER NOT NULL DEFAULT 1);
		CREATE TABLE crosswalk (id INTEGER PRIMARY KEY, slug TEXT, method TEXT, purpose TEXT, from_release_id INTEGER, to_release_id INTEGER);
		CREATE TABLE crosswalk_edge (crosswalk_id INTEGER, from_version_id INTEGER, to_version_id INTEGER, change TEXT, relation TEXT);
		CREATE TABLE crosswalk_weight (crosswalk_id INTEGER, from_version_id INTEGER, to_version_id INTEGER, basis_id TEXT, weight REAL, source_share REAL);
		CREATE TABLE crosswalk_source (crosswalk_id INTEGER, from_version_id INTEGER, coverage REAL);
		CREATE TABLE conversion_error (method TEXT, basis_id TEXT, measure_class TEXT, factor REAL);
		INSERT INTO weight_basis VALUES ('area'), ('population'), ('households'), ('dwellings'), ('postcodes');
		INSERT INTO area_release VALUES
		  (1, 'ward', '2011', 3), (2, 'ward', '2018', 2), (3, 'ward', '2026', 1),
		  (4, 'localAuthority', '2023', 5), (5, 'localAuthority', '2026', 4),
		  (6, 'constituency', '2010', 7), (7, 'constituency', '2024', 6);
		INSERT INTO area VALUES (1, 'A'), (2, 'D'), (3, 'E'), (4, 'B'), (5, 'C'), (6, 'X'), (7, 'Y'), (8, 'LA1'), (9, 'K1'), (10, 'K2'), (11, 'F'), (12, 'H'), (13, 'G');
		INSERT INTO area_version (id, area_id, release_id, name) VALUES
		  (1, 1, 1, 'Alpha'), (2, 2, 1, 'Delta'), (3, 3, 1, 'Echo'),
		  (4, 4, 2, 'Bravo'), (5, 5, 2, 'Charlie'),
		  (6, 6, 3, 'Xray'), (7, 7, 3, 'Yankee'),
		  (8, 8, 4, 'Old LA'), (9, 8, 5, 'New LA'),
		  (10, 9, 6, 'Old K'), (11, 10, 7, 'New K'),
		  (13, 12, 1, 'Hotel'), (14, 13, 2, 'Golf');
		INSERT INTO area_version (id, area_id, release_id, name, in_inventory) VALUES
		  (12, 11, 1, 'Foxtrot', 0);
		INSERT INTO crosswalk VALUES
		  (1, 'ward-2011-to-2018', 'population-overlap', NULL, 1, 2),
		  (2, 'ward-2018-to-2026', 'population-overlap', NULL, 2, 3),
		  (3, 'la-2023-to-2026', 'extent-continuity', NULL, 4, 5);
		INSERT INTO crosswalk_edge VALUES
		  (1, 1, 4, NULL, NULL), (1, 1, 5, NULL, NULL), (1, 2, 5, NULL, NULL),
		  (2, 4, 6, NULL, NULL), (2, 5, 6, NULL, NULL), (2, 5, 7, NULL, NULL),
		  (1, 13, 5, NULL, NULL), (1, 13, 14, NULL, NULL),
		  (3, 8, 9, 'unchanged', NULL);
	`);
	const weigh = database.prepare(
		"INSERT INTO crosswalk_weight VALUES (?, ?, ?, ?, ?, ?)",
	);
	for (const basis of BASES) {
		const first = basis === "population" ? 0.25 : 0.5;
		weigh.run(1, 1, 4, basis, first, null);
		weigh.run(1, 1, 5, basis, 1 - first, null);
		weigh.run(1, 2, 5, basis, 1, 1);
		weigh.run(1, 13, 5, basis, 0.5, null);
		weigh.run(1, 13, 14, basis, 0.5, null);
		weigh.run(2, 4, 6, basis, 1, 1);
		weigh.run(2, 5, 6, basis, 0.5, null);
		weigh.run(2, 5, 7, basis, 0.5, null);
	}
	database.exec(
		"INSERT INTO conversion_error VALUES ('population-overlap', 'population', 'total population', 0.5)",
	);
	return database;
};

const written = () => {
	const database = fixture();
	const ids = IdRegistries.memory();
	const summary = writeCrosswalkChains(database, ids);
	return { database, ids, summary };
};

type Row = Record<string, string | number | null>;
const all = (database: DatabaseSync, sql: string) =>
	(database.prepare(sql).all() as Row[]).map((row) => ({ ...row }));

const edgeBetween = (
	database: DatabaseSync,
	basis: string,
	from: string,
	to: string,
) =>
	database
		.prepare(
			"SELECT * FROM v_crosswalk_chain_edge WHERE geography = 'ward' AND basis = ? AND from_code = ? AND to_code = ?",
		)
		.get(basis, from, to) as Row;

describe("writeCrosswalkChains", () => {
	test("joins every old release to the current one and says what could not be", () => {
		const { database, summary } = written();
		assert.deepEqual(
			all(
				database,
				"SELECT r.geography, r.release, c.basis_id, c.hops, c.exact FROM crosswalk_chain c JOIN area_release r ON r.id = c.from_release_id ORDER BY c.id",
			),
			[
				["localAuthority", "2023", null, 1, 1],
				["ward", "2018", null, 1, 0],
				["ward", "2011", "population", 2, 0],
				["ward", "2011", "households", 2, 0],
				["ward", "2011", "dwellings", 2, 0],
				["ward", "2011", "postcodes", 2, 0],
			].map(([geography, release, basis_id, hops, exact]) => ({
				geography,
				release,
				basis_id,
				hops,
				exact,
			})),
		);
		assert.deepEqual(summary.unrouted, [
			{ geography: "constituency", release: "2010" },
		]);
		assert.equal(summary.chains, 6);
		assert.equal(
			summary.edges,
			(
				database
					.prepare("SELECT count(*) AS n FROM crosswalk_chain_edge")
					.get() as { n: number }
			).n,
		);
	});

	test("weights multiply along the route and add across branches", () => {
		const { database } = written();
		// A reaches X by B (0.25 * 1) and by C (0.75 * 0.5), Y by C alone.
		near(
			edgeBetween(database, "population", "A", "X").weight as number,
			0.625,
		);
		near(
			edgeBetween(database, "population", "A", "Y").weight as number,
			0.375,
		);
		// D is carried whole to C, then half each way.
		near(
			edgeBetween(database, "population", "D", "X").weight as number,
			0.5,
		);
		// Households split A evenly, so the same pair weighs differently.
		near(
			edgeBetween(database, "households", "A", "X").weight as number,
			0.75,
		);
		for (const basis of BASES)
			for (const from of ["A", "D"])
				near(
					(
						database
							.prepare(
								"SELECT sum(weight) AS w FROM v_crosswalk_chain_edge WHERE geography = 'ward' AND from_release = '2011' AND basis = ? AND from_code = ?",
							)
							.get(basis, from) as { w: number }
					).w,
					1,
				);
	});

	test("error adds up as the converter adds it", () => {
		const { database } = written();
		const toX = edgeBetween(database, "population", "A", "X");
		// Via B: the quarter at risk of its own split (0.25 * 0.75), nothing more.
		// Via C: that split's 0.1875 halved, plus the 0.75 that C then splits
		// evenly (0.5 * 0.5 each).
		near(toX.at_risk as number, 0.1875 + (0.1875 * 0.5 + 0.75 * 0.25));
		near(toX.pruned as number, 0);
		// A value that only a split of the second step touched has half the risk.
		near(
			edgeBetween(database, "population", "D", "X").at_risk as number,
			0.25,
		);
		assert.ok((toX.estimated_share as number) <= 1);
	});

	test("bounds come from the backtest's factor, and are null where it is not measured", () => {
		const { database } = written();
		const toX = edgeBetween(database, "population", "A", "X");
		const half = 0.5 * (toX.at_risk as number);
		near(toX.weight_lower as number, 0.625 - half);
		near(toX.weight_upper as number, 0.625 + half);
		const households = edgeBetween(database, "households", "A", "X");
		assert.equal(households.weight_lower, null);
		assert.equal(households.weight_upper, null);
	});

	test("an exact chain is stored once and read for every basis", () => {
		const { database } = written();
		assert.equal(
			(
				database
					.prepare(
						"SELECT count(*) AS n FROM crosswalk_chain WHERE exact = 1",
					)
					.get() as { n: number }
			).n,
			1,
		);
		const rows = all(
			database,
			"SELECT basis, weight, weight_lower, weight_upper, at_risk, complete, from_name, to_name FROM v_crosswalk_chain_edge WHERE geography = 'localAuthority' ORDER BY basis",
		);
		assert.deepEqual(
			rows.map((row) => row.basis),
			["dwellings", "households", "population", "postcodes"],
		);
		for (const row of rows) {
			assert.equal(row.weight, 1);
			assert.equal(row.at_risk, 0);
			// Nothing can be wrong, so the bounds close on the weight for any basis.
			assert.equal(row.weight_lower, 1);
			assert.equal(row.weight_upper, 1);
			assert.equal(row.complete, 1);
			assert.equal(row.from_name, "Old LA");
			assert.equal(row.to_name, "New LA");
		}
	});

	test("a chain that is the same on every basis is stored once", () => {
		const { database } = written();
		// 2018 to 2026 has the same weights on all four bases.
		assert.equal(
			(
				database
					.prepare(
						"SELECT count(*) AS n FROM crosswalk_chain c JOIN area_release r ON r.id = c.from_release_id WHERE r.release = '2018' AND c.basis_id IS NULL",
					)
					.get() as { n: number }
			).n,
			1,
		);
		assert.equal(
			all(
				database,
				"SELECT 1 FROM v_crosswalk_chain_edge WHERE from_release = '2018' AND from_code = 'C' AND to_code = 'X'",
			).length,
			4,
		);
	});

	test("an area in no crosswalk is a gap with no edge, read without being stored", () => {
		const { database } = written();
		const gaps = all(
			database,
			"SELECT from_code, basis, reason, has_edge FROM v_crosswalk_chain_gap WHERE geography = 'ward' ORDER BY from_code, basis",
		);
		assert.deepEqual(
			gaps.filter((row) => row.from_code === "E"),
			["dwellings", "households", "population", "postcodes"].map(
				(basis) => ({
					from_code: "E",
					basis,
					reason: "not-in-crosswalk",
					has_edge: 0,
				}),
			),
		);
		assert.equal(
			all(
				database,
				"SELECT 1 FROM v_crosswalk_chain_edge WHERE from_code = 'E'",
			).length,
			0,
		);
		// The area is stored nowhere, so the table holds only what edges cannot show.
		assert.deepEqual(
			all(
				database,
				"SELECT g.chain_id FROM crosswalk_chain_gap g JOIN area_version v ON v.id = g.from_version_id WHERE v.area_id = 3",
			),
			[],
		);
	});

	test("an area that loses only part of its value is a gap with edges", () => {
		const { database } = written();
		assert.deepEqual(
			all(
				database,
				"SELECT from_code, from_release, basis, reason, has_edge FROM v_crosswalk_chain_gap WHERE from_code = 'H' ORDER BY basis",
			).map((row) => [
				row.from_release,
				row.basis,
				row.reason,
				row.has_edge,
			]),
			["dwellings", "households", "population", "postcodes"].map(
				(basis) => ["2011", basis, "not-in-crosswalk", 1],
			),
		);
		// Its value that is carried on still arrives: half of H reaches X and Y by C.
		near(
			edgeBetween(database, "population", "H", "X").weight as number,
			0.25,
		);
		assert.equal(
			all(
				database,
				"SELECT g.chain_id FROM crosswalk_chain_gap g JOIN area_version v ON v.id = g.from_version_id WHERE v.area_id = 12",
			).length,
			4,
		);
	});

	test("a chain counts every area that loses value, stored or not", () => {
		const { database } = written();
		assert.deepEqual(
			all(
				database,
				"SELECT c.id, c.gaps, (SELECT count(DISTINCT from_version_id) FROM v_crosswalk_chain_gap v WHERE v.chain_id = c.id) AS seen FROM crosswalk_chain c WHERE c.gaps <> seen",
			),
			[],
		);
	});

	test("an area outside the old release's inventory is neither an edge nor a gap", () => {
		const { database } = written();
		assert.deepEqual(
			all(
				database,
				"SELECT 1 FROM crosswalk_chain_gap g WHERE g.from_version_id = 12 UNION ALL SELECT 1 FROM crosswalk_chain_edge e WHERE e.from_version_id = 12",
			),
			[],
		);
	});

	test("lists the crosswalks each chain joins, in route order", () => {
		const { database } = written();
		assert.deepEqual(
			all(
				database,
				"SELECT h.position, h.crosswalk_id, h.reversed FROM crosswalk_chain_hop h JOIN crosswalk_chain c ON c.id = h.chain_id JOIN area_release r ON r.id = c.from_release_id WHERE r.release = '2011' AND c.basis_id = 'population' ORDER BY h.position",
			),
			[
				{ position: 1, crosswalk_id: 1, reversed: 0 },
				{ position: 2, crosswalk_id: 2, reversed: 0 },
			],
		);
	});

	test("assigns stable ids by geography, releases and basis", () => {
		const { database, ids } = written();
		const population = database
			.prepare(
				"SELECT c.id FROM crosswalk_chain c JOIN area_release r ON r.id = c.from_release_id WHERE r.release = '2011' AND c.basis_id = 'population'",
			)
			.get() as { id: number };
		assert.equal(
			ids.crosswalkChain.assign("ward", "2011", "2026", "population"),
			population.id,
		);
		// Keys are numbered in the order they are met, geographies by name.
		assert.equal(
			ids.crosswalkChain.assign("localAuthority", "2023", "2026", "any"),
			1,
		);
		// The same database built again numbers the keys the same way.
		const again = fixture();
		writeCrosswalkChains(again, ids);
		assert.deepEqual(
			all(again, "SELECT id FROM crosswalk_chain ORDER BY id"),
			all(database, "SELECT id FROM crosswalk_chain ORDER BY id"),
		);
	});
});
