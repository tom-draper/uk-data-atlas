import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import {
	areaTables,
	crosswalkTables,
	readCrosswalkById,
	writeCrosswalkWeights,
	writeSqliteIndex,
} from "../src/storage/index";
import { closeAllReadOnlyDatabases } from "@uk-data-atlas/atlas-runtime/storage";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";

const release = (geography: string, id: string, codes: string[]) => ({
	id,
	geography,
	status: "available" as const,
	recordCount: codes.length,
	artifact: `areas/${geography}/${id}.json`,
	contentHash: `sha256:${geography}-${id}`,
	codeProperty: "code",
	nameProperty: "name",
});

const releases = [
	release("ward", "2024", ["A", "B", "C"]),
	release("ward", "2025", ["A", "B", "C"]),
	release("constituency", "2024", ["X", "Y"]),
	release("lsoa", "2021", ["U1", "U2", "U3"]),
];

const ward = { geography: "ward", boundaryRelease: "2024" };
const constituency = { geography: "constituency", boundaryRelease: "2024" };

const crosswalks = [
	{
		schemaVersion: 1,
		id: "ward-to-constituency-lookup",
		method: "official-lookup",
		quality: "publisher-supplied",
		weighting: { status: "not-provided" },
		from: ward,
		to: constituency,
		contentHash: "sha256:lookup",
		records: [
			{
				source: { code: "A", labels: ["A"] },
				targets: [
					{ code: "X", labels: ["X"] },
					{ code: "Y", labels: ["Y"] },
				],
			},
			{
				source: { code: "B", labels: ["B"] },
				targets: [
					{ code: "X", labels: ["X"] },
					{ code: "Y", labels: ["Y"] },
				],
			},
			{
				source: { code: "C", labels: ["C"] },
				targets: [{ code: "X", labels: ["X"] }],
			},
		],
	},
	{
		// Already weighted by population from census blocks.
		schemaVersion: 1,
		id: "ward-to-constituency-population",
		method: "population-overlap",
		quality: "derived",
		weighting: {
			status: "provided",
			basis: "population",
			normalisation: "per-source",
			population: "Census 2021 usual residents",
			date: "2021-03-21",
			blocks: { geography: "lsoa", boundaryRelease: "2021" },
		},
		from: ward,
		to: constituency,
		contentHash: "sha256:population",
		records: [
			{
				source: {
					code: "A",
					labels: ["A"],
					population: 90,
					coverage: 1,
				},
				targets: [
					{
						code: "X",
						labels: ["X"],
						weight: 0.5,
						population: 45,
						sourceShare: 0.5,
						targetShare: 0.25,
						overlapAreaM2: 7,
					},
					{
						code: "Y",
						labels: ["Y"],
						weight: 0.5,
						population: 45,
						sourceShare: 0.5,
						targetShare: 0.75,
						overlapAreaM2: 3,
					},
				],
			},
		],
	},
	{
		// Same geography, so identity: left alone.
		schemaVersion: 1,
		id: "ward-2024-to-2025",
		method: "extent-continuity",
		quality: "derived",
		relationshipPurpose: "identity",
		weighting: { status: "not-applicable" },
		from: ward,
		to: { geography: "ward", boundaryRelease: "2025" },
		contentHash: "sha256:identity",
		records: [
			{
				source: { code: "A", labels: ["A"] },
				targets: [{ code: "A", labels: ["A"] }],
			},
		],
	},
];

const fixture = (context: { onTestFinished: (run: () => void) => void }) => {
	const root = mkdtempSync(join(tmpdir(), "crosswalk-weights-"));
	context.onTestFinished(() => {
		closeAllReadOnlyDatabases();
		rmSync(root, { recursive: true, force: true });
	});
	const artifacts = join(root, "data/build/artifacts");
	mkdirSync(join(artifacts, "crosswalks"), { recursive: true });
	const write = (path: string, value: unknown) => {
		mkdirSync(join(artifacts, path, ".."), { recursive: true });
		writeFileSync(join(artifacts, path), JSON.stringify(value));
	};
	write("area-inventory.json", {
		schemaVersion: 1,
		contentHash: "sha256:inventory",
		boundaryRegistryHash: "sha256:registry",
		releases,
	});
	for (const entry of releases)
		write(entry.artifact, {
			schemaVersion: 1,
			contentHash: entry.contentHash,
			areas: Array.from({ length: entry.recordCount }, (_, index) => ({
				code: [
					["A", "B", "C"],
					["A", "B", "C"],
					["X", "Y"],
					["U1", "U2", "U3"],
				][releases.indexOf(entry)]![index]!,
				name: "Area",
			})),
		});
	for (const crosswalk of crosswalks)
		write(`crosswalks/${crosswalk.id}.json`, crosswalk);
	const inventory = {
		schemaVersion: 1 as const,
		contentHash: "sha256:crosswalks",
		crosswalks: crosswalks.map((crosswalk) => ({
			id: crosswalk.id,
			from: crosswalk.from,
			to: crosswalk.to,
			method: crosswalk.method,
			quality: crosswalk.quality,
			...("relationshipPurpose" in crosswalk
				? { relationshipPurpose: crosswalk.relationshipPurpose }
				: {}),
			weighting: crosswalk.weighting,
			recordCount: crosswalk.records.length,
			artifact: `crosswalks/${crosswalk.id}.json`,
			contentHash: crosswalk.contentHash,
		})),
	} as unknown as CrosswalkInventory;
	write("crosswalk-inventory.json", inventory);
	const path = join(root, "data/build/atlas-base.sqlite");
	writeSqliteIndex(
		path,
		{},
		{ ...areaTables(artifacts), ...crosswalkTables(artifacts) },
	);
	return { root, path, inventory };
};

/**
 * Postcodes in three sets of (ward, constituency, lsoa), plus the ones that
 * must not count: a large user, a terminated postcode and one with no areas.
 *
 *   set 1: A, X, U1   p1 p2 (+ p4 large user, p5 terminated)
 *   set 2: A, Y, U1   p3
 *   set 3: B, Y, U2   p6
 *   set 4: C, X, U2   p7
 *   set 5: none       p8
 */
const addPostcodes = (database: DatabaseSync) => {
	const version = (geography: string, code: string) =>
		Number(
			database
				.prepare(
					"SELECT v.id AS id FROM area_version v JOIN area a ON a.id = v.area_id JOIN area_releases r ON r.position = v.release_id WHERE r.geography = ? AND a.code = ?",
				)
				.get(geography, code)!.id,
		);
	database.exec(`
		CREATE TABLE postcode_area_releases (position INTEGER PRIMARY KEY, geography TEXT NOT NULL, boundaryRelease TEXT NOT NULL, areaColumn TEXT NOT NULL, distanceColumn TEXT NOT NULL, distanceFallback INTEGER);
		INSERT INTO postcode_area_releases VALUES (0, 'ward', '2024', 'wardAreaId', 'wardDistanceCm', NULL), (1, 'constituency', '2024', 'constituencyAreaId', 'constituencyDistanceCm', NULL), (2, 'lsoa', '2021', 'lsoaAreaId', 'lsoaDistanceCm', NULL);
		CREATE TABLE postcode_area_set (id INTEGER PRIMARY KEY, wardAreaId INTEGER, constituencyAreaId INTEGER, lsoaAreaId INTEGER);
		CREATE TABLE postcodes (postcode TEXT PRIMARY KEY, terminated INTEGER NOT NULL, largeUser TEXT NOT NULL, area_set_id INTEGER NOT NULL);`);
	const sets: Array<[number, string, string, string] | [number]> = [
		[1, "A", "X", "U1"],
		[2, "A", "Y", "U1"],
		[3, "B", "Y", "U2"],
		[4, "C", "X", "U2"],
		[5],
	];
	for (const [id, w, c, l] of sets)
		database
			.prepare("INSERT INTO postcode_area_set VALUES (?, ?, ?, ?)")
			.run(
				id!,
				w ? version("ward", w) : null,
				c ? version("constituency", c) : null,
				l ? version("lsoa", l) : null,
			);
	const rows: Array<[string, number, string, number]> = [
		["p1", 0, "0", 1],
		["p2", 0, "0", 1],
		["p3", 0, "0", 2],
		["p4", 0, "1", 1],
		["p5", 1, "0", 1],
		["p6", 0, "0", 3],
		["p7", 0, "0", 4],
		["p8", 0, "0", 5],
	];
	for (const row of rows)
		database
			.prepare("INSERT INTO postcodes VALUES (?, ?, ?, ?)")
			.run(...row);
};

const units = [
	{
		basis: "population" as const,
		geography: "lsoa",
		boundaryRelease: "2021",
		// U3 has people but no postcode.
		totals: new Map([
			["U1", 90],
			["U2", 60],
			["U3", 7],
		]),
	},
	{
		basis: "households" as const,
		geography: "lsoa",
		boundaryRelease: "2021",
		totals: new Map([
			["U1", 30],
			["U2", 20],
		]),
	},
];

const weights = (database: DatabaseSync, slug: string, basis: string) =>
	database
		.prepare(
			"SELECT from_code, to_code, weight, overlap, source_share, target_share FROM v_crosswalk_edge WHERE crosswalk = ? AND basis = ? ORDER BY from_code, to_code",
		)
		.all(slug, basis)
		.map((row) => Object.values(row));

const near = (actual: unknown[][], expected: unknown[][]) => {
	assert.equal(actual.length, expected.length);
	for (const [index, row] of expected.entries())
		for (const [column, value] of row.entries()) {
			const found = actual[index]![column];
			if (typeof value === "number")
				assert.ok(
					Math.abs((found as number) - value) < 1e-9,
					`row ${index} column ${column}: ${String(found)} is not ${value}`,
				);
			else assert.equal(found, value);
		}
};

test("edges are weighted by the postcodes in both areas of each pair", (context) => {
	const { path } = fixture(context);
	const database = new DatabaseSync(path);
	context.onTestFinished(() => {
		if (database.isOpen) database.close();
	});
	addPostcodes(database);
	const summary = writeCrosswalkWeights(database, units);
	const lookup = "ward-to-constituency-lookup";
	// Large users, terminated postcodes and postcodes without areas do not
	// count. A: X 2, Y 1 of 3. B: Y 1 of 1 (no edge to X, which holds no B).
	// X holds 3 postcodes (p1, p2, p7), Y holds 2 (p3, p6).
	near(weights(database, lookup, "postcodes"), [
		["A", "X", 2 / 3, 2, 2 / 3, 2 / 3],
		["A", "Y", 1 / 3, 1, 1 / 3, 1 / 2],
		["B", "Y", 1, 1, 1, 1 / 2],
		["C", "X", 1, 1, 1, 1 / 3],
	]);
	// U1's 90 people share its three live postcodes, 30 each; U2's 60 share two.
	near(weights(database, lookup, "population"), [
		["A", "X", 2 / 3, 60, 2 / 3, 60 / 90],
		["A", "Y", 1 / 3, 30, 1 / 3, 30 / 60],
		["B", "Y", 1, 30, 1, 30 / 60],
		["C", "X", 1, 30, 1, 30 / 90],
	]);
	near(weights(database, lookup, "households"), [
		["A", "X", 2 / 3, 20, 2 / 3, 20 / 30],
		["A", "Y", 1 / 3, 10, 1 / 3, 10 / 20],
		["B", "Y", 1, 10, 1, 10 / 20],
		["C", "X", 1, 10, 1, 10 / 30],
	]);
	// Each source's weights sum to 1 on every basis.
	assert.equal(
		database
			.prepare(
				"SELECT count(*) AS n FROM (SELECT crosswalk_id, from_version_id, basis_id, sum(weight) AS total FROM crosswalk_weight GROUP BY 1, 2, 3 HAVING abs(total - 1) > 1e-9)",
			)
			.get()!.n,
		0,
	);
	assert.deepEqual(summary.units, [
		{
			basis: "population",
			geography: "lsoa",
			boundaryRelease: "2021",
			placed: true,
			held: 157,
			allocated: 150,
		},
		{
			basis: "households",
			geography: "lsoa",
			boundaryRelease: "2021",
			placed: true,
			held: 50,
			allocated: 50,
		},
	]);
	assert.deepEqual(
		summary.crosswalks.map(({ slug, edges, weighted }) => ({
			slug,
			edges,
			weighted,
		})),
		[
			{
				slug: lookup,
				edges: 5,
				weighted: { postcodes: 4, population: 4, households: 4 },
			},
			{
				slug: "ward-to-constituency-population",
				edges: 2,
				weighted: { postcodes: 2, households: 2 },
			},
		],
	);
});

test("a crosswalk keeps its own basis, and identity crosswalks get none", (context) => {
	const { path, root, inventory } = fixture(context);
	const database = new DatabaseSync(path);
	context.onTestFinished(() => {
		if (database.isOpen) database.close();
	});
	addPostcodes(database);
	writeCrosswalkWeights(database, units);
	// The census-block population weights are untouched.
	near(weights(database, "ward-to-constituency-population", "population"), [
		["A", "X", 0.5, 45, 0.5, 0.25],
		["A", "Y", 0.5, 45, 0.5, 0.75],
	]);
	assert.equal(
		database
			.prepare(
				"SELECT count(*) AS n FROM crosswalk_weight w JOIN crosswalk c ON c.id = w.crosswalk_id WHERE c.slug = 'ward-2024-to-2025'",
			)
			.get()!.n,
		0,
	);
	// A second run replaces the postcode rows rather than failing on them.
	const rows = () =>
		database.prepare("SELECT count(*) AS n FROM crosswalk_weight").get()!.n;
	const before = rows();
	writeCrosswalkWeights(database, units);
	assert.equal(rows(), before);
	database.close();
	// The extra bases do not change the artifact the edges rebuild.
	for (const entry of inventory.crosswalks)
		assert.deepEqual(
			readCrosswalkById(root, entry, path),
			crosswalks.find((crosswalk) => crosswalk.id === entry.id),
		);
});

test("units in a release postcodes are not placed in are reported, not shared", (context) => {
	const { path } = fixture(context);
	const database = new DatabaseSync(path);
	context.onTestFinished(() => {
		if (database.isOpen) database.close();
	});
	addPostcodes(database);
	const summary = writeCrosswalkWeights(database, [
		{
			basis: "population",
			geography: "dataZone",
			boundaryRelease: "2011",
			totals: new Map([["S01", 10]]),
		},
	]);
	assert.deepEqual(summary.units, [
		{
			basis: "population",
			geography: "dataZone",
			boundaryRelease: "2011",
			placed: false,
			held: 10,
			allocated: 0,
		},
	]);
	// Postcode counts still weight the edges; there is no population basis.
	assert.equal(
		database
			.prepare(
				"SELECT count(*) AS n FROM crosswalk_weight WHERE basis_id = 'population' AND crosswalk_id = 0",
			)
			.get()!.n,
		0,
	);
	assert.equal(
		database
			.prepare(
				"SELECT count(*) AS n FROM crosswalk_weight WHERE basis_id = 'postcodes' AND crosswalk_id = 0",
			)
			.get()!.n,
		4,
	);
});
