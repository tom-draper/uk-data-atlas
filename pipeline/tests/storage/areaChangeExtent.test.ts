import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, test } from "vitest";
import { writeAreaChangeExtent } from "../../src/storage/areaChangeExtent.ts";

const BASES = ["population", "households", "dwellings", "postcodes"] as const;

/**
 * Wards in 2020 (release 1) and 2021 (release 2), with a second 2020 edition
 * (release 3) of the same vintage, which is never paired.
 *
 * Crosswalk 1 (extent-continuity): U is the same extent in both. Its
 * validation measured R as redrawn: 90% of the old R is in the new R, which is
 * 95% the old R.
 * Crosswalk 2 (population-overlap):
 * - S splits: 70% of its residents stay in S, 30% go to the new T.
 * - M1 and M2 merge into N, which is 60% M1 and 40% M2 by residents. By land
 *   N is 55% M1.
 * - R is all of R by residents.
 *
 * Constituencies in two releases with no crosswalk.
 */
const fixture = () => {
	const database = new DatabaseSync(":memory:");
	database.exec(`
		CREATE TABLE weight_basis (id TEXT PRIMARY KEY);
		CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT, inventory_position INTEGER, reference_year INTEGER, reference_month INTEGER);
		CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER, name TEXT, in_inventory INTEGER NOT NULL DEFAULT 1);
		CREATE TABLE crosswalk (id INTEGER PRIMARY KEY, slug TEXT, method TEXT, purpose TEXT, from_release_id INTEGER, to_release_id INTEGER, validation TEXT);
		CREATE TABLE crosswalk_edge (crosswalk_id INTEGER, from_version_id INTEGER, to_version_id INTEGER, change TEXT, relation TEXT);
		CREATE TABLE crosswalk_weight (crosswalk_id INTEGER, from_version_id INTEGER, to_version_id INTEGER, basis_id TEXT, weight REAL, source_share REAL, target_share REAL);
		CREATE TABLE crosswalk_source (crosswalk_id INTEGER, from_version_id INTEGER, coverage REAL);
		INSERT INTO weight_basis VALUES ('area'), ('population'), ('households'), ('dwellings'), ('postcodes');
		INSERT INTO area_release VALUES
		  (1, 'ward', '2020', 2, 2020, 12), (2, 'ward', '2021', 1, 2021, 12),
		  (3, 'ward', '2020-alt', 3, 2020, 12),
		  (4, 'constituency', '2010', 5, 2010, NULL), (5, 'constituency', '2024', 4, 2024, NULL);
		INSERT INTO area VALUES (1, 'U'), (2, 'S'), (3, 'T'), (4, 'M1'), (5, 'M2'), (6, 'N'), (7, 'R'), (8, 'K1'), (9, 'K2');
		INSERT INTO area_version (id, area_id, release_id, name) VALUES
		  (1, 1, 1, 'Unchanged'), (2, 2, 1, 'Split'), (3, 4, 1, 'Merged one'), (4, 5, 1, 'Merged two'), (5, 7, 1, 'Redrawn'),
		  (11, 1, 2, 'Unchanged'), (12, 2, 2, 'Split'), (13, 3, 2, 'Split off'), (14, 6, 2, 'Merger'), (15, 7, 2, 'Redrawn'),
		  (21, 1, 3, 'Unchanged'),
		  (31, 8, 4, 'Old'), (32, 9, 5, 'New');
		INSERT INTO crosswalk VALUES
		  (1, 'ward-2020-to-2021-continuity', 'extent-continuity', NULL, 1, 2,
		   '{"continuity":{"changedExtent":[{"code":"R","relation":"changed","sourceShare":0.9,"targetShare":0.95}],"realigned":[]}}'),
		  (2, 'ward-2020-to-2021-population', 'population-overlap', NULL, 1, 2, NULL);
		INSERT INTO crosswalk_edge VALUES
		  (1, 1, 11, NULL, NULL),
		  (2, 2, 12, NULL, NULL), (2, 2, 13, NULL, NULL),
		  (2, 3, 14, NULL, NULL), (2, 4, 14, NULL, NULL),
		  (2, 5, 15, NULL, NULL);
	`);
	const weigh = database.prepare(
		"INSERT INTO crosswalk_weight VALUES (2, ?, ?, ?, ?, NULL, ?)",
	);
	for (const basis of BASES) {
		weigh.run(2, 12, basis, 0.7, 1);
		weigh.run(2, 13, basis, 0.3, 1);
		weigh.run(3, 14, basis, 1, 0.6);
		weigh.run(4, 14, basis, 1, 0.4);
		weigh.run(5, 15, basis, 1, 1);
	}
	weigh.run(3, 14, "area", 1, 0.55);
	return database;
};

type Row = Record<string, string | number | null>;
const rowsOf = (database: DatabaseSync) =>
	Object.fromEntries(
		(
			database
				.prepare(
					"SELECT from_code, to_code, successor, residents_lost, residents_gained, land_lost, land_gained, land_basis, materially_changed FROM v_area_change_extent ORDER BY from_code",
				)
				.all() as Row[]
		).map(({ from_code, ...rest }) => [from_code, { ...rest }]),
	);

const near = (actual: unknown, expected: number) =>
	assert.ok(
		typeof actual === "number" && Math.abs(actual - expected) < 1e-12,
		`${actual} is not ${expected}`,
	);

describe("writeAreaChangeExtent", () => {
	const database = fixture();
	const summary = writeAreaChangeExtent(database);
	const rows = rowsOf(database);

	test("an unchanged area changed nothing", () => {
		assert.deepEqual(rows.U, {
			to_code: "U",
			successor: "same-code",
			residents_lost: 0,
			residents_gained: 0,
			land_lost: 0,
			land_gained: 0,
			land_basis: "continuous",
			materially_changed: 0,
		});
	});

	test("a split keeps its code and loses the residents that moved", () => {
		const split = rows.S!;
		assert.equal(split.to_code, "S");
		assert.equal(split.successor, "same-code");
		near(split.residents_lost, 0.3);
		assert.equal(split.residents_gained, 0);
		assert.equal(split.land_basis, null);
		assert.equal(split.materially_changed, 1);
		assert.equal(rows.T, undefined, "a new area is no one's successor row");
	});

	test("a merge persists into the feeder that gave the most residents", () => {
		const merged = rows.M1!;
		assert.equal(merged.to_code, "N");
		assert.equal(merged.successor, "largest-share");
		assert.equal(merged.residents_lost, 0);
		near(merged.residents_gained, 0.4);
		assert.equal(merged.land_lost, 0);
		near(merged.land_gained, 0.45);
		assert.equal(merged.land_basis, "area-weight");
		assert.equal(merged.materially_changed, 1);
		assert.equal(rows.M2, undefined, "the smaller feeder ended");
	});

	test("a redrawn area has its measured land shares", () => {
		const redrawn = rows.R!;
		assert.equal(redrawn.residents_lost, 0);
		assert.equal(redrawn.residents_gained, 0);
		near(redrawn.land_lost, 0.1);
		near(redrawn.land_gained, 0.05);
		assert.equal(redrawn.land_basis, "measured");
		assert.equal(redrawn.materially_changed, 1);
	});

	test("pairs each release with the next vintage and lists the rest", () => {
		assert.deepEqual(
			(
				database
					.prepare("SELECT * FROM area_change_extent_pair")
					.all() as Row[]
			).map((row) => ({ ...row })),
			[
				{
					from_release_id: 1,
					to_release_id: 2,
					crosswalks: "1,2",
					reversed: 0,
					sources: 5,
					persisting: 4,
					ended: 1,
					blocked: 0,
					unlinked: 0,
				},
			],
		);
		assert.deepEqual(summary, {
			pairs: 1,
			rows: 4,
			unpaired: [
				{ geography: "constituency", release: "2010" },
				{ geography: "ward", release: "2020-alt" },
			],
		});
	});
});
