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
					{ code: "X", labels: ["X"], change: "split" },
					{ code: "Y", labels: ["Y"], change: "split" },
				],
			},
			{
				source: { code: "B", labels: ["B"] },
				targets: [{ code: "Y", labels: ["Y"], change: "unchanged" }],
			},
			{
				source: { code: "C", labels: ["C"] },
				targets: [{ code: "X", labels: ["X"], change: "merged" }],
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

const all = (database: DatabaseSync, sql: string) =>
	database
		.prepare(sql)
		.all()
		.map((row) => Object.values(row));

const view = (database: DatabaseSync, slug: string, extra = "") =>
	all(
		database,
		`SELECT from_code, to_code, basis, weight, overlap, source_share, target_share, derivation FROM v_crosswalk_weight WHERE crosswalk = '${slug}' ${extra} ORDER BY from_code, to_code, basis`,
	);

const BASES = ["area", "dwellings", "households", "population", "postcodes"];

test("exact edges weigh 1 on every basis without a stored row, others come from the table", (context) => {
	const { path } = fixture(context);
	const database = new DatabaseSync(path);
	context.onTestFinished(() => {
		if (database.isOpen) database.close();
	});
	const ids = Object.fromEntries(
		all(database, "SELECT slug, id FROM crosswalk") as Array<
			[string, number]
		>,
	);
	const version = (geography: string, code: string) =>
		Number(
			database
				.prepare(
					"SELECT v.id AS id FROM area_version v JOIN area a ON a.id = v.area_id JOIN area_releases r ON r.position = v.release_id WHERE r.geography = ? AND a.code = ?",
				)
				.get(geography, code)!.id,
		);
	const lookup = ids["ward-to-constituency-lookup"]!;
	database
		.prepare(
			"INSERT INTO crosswalk_weight VALUES (?, ?, ?, 'postcodes', ?, ?, ?, ?)",
		)
		.run(
			lookup,
			version("ward", "A"),
			version("constituency", "X"),
			0.25,
			1,
			0.25,
			0.5,
		);
	// A to X is a split: stored. B to Y is unchanged: exact on every basis.
	assert.deepEqual(
		view(database, "ward-to-constituency-lookup", "AND from_code <> 'C'"),
		[
			["A", "X", "postcodes", 0.25, 1, 0.25, 0.5, "stored"],
			...BASES.map((basis) => [
				"B",
				"Y",
				basis,
				1,
				null,
				1,
				null,
				"exact",
			]),
		],
	);
	// C to X is merged and has no stored row, so it has none at all.
	assert.deepEqual(
		view(database, "ward-to-constituency-lookup", "AND from_code = 'C'"),
		[],
	);
	// A stored row is not repeated as an implicit one.
	database
		.prepare(
			"INSERT INTO crosswalk_weight VALUES (?, ?, ?, 'households', ?, ?, ?, ?)",
		)
		.run(
			lookup,
			version("ward", "B"),
			version("constituency", "Y"),
			0.9,
			3,
			0.9,
			0.9,
		);
	assert.deepEqual(
		view(
			database,
			"ward-to-constituency-lookup",
			"AND from_code = 'B' AND basis = 'households'",
		),
		[["B", "Y", "households", 0.9, 3, 0.9, 0.9, "stored"]],
	);
	// Identity edges are exact; a crosswalk's own weights are stored.
	assert.deepEqual(
		view(database, "ward-2024-to-2025").map((row) => row[2]),
		BASES,
	);
	assert.deepEqual(
		view(database, "ward-to-constituency-population").map((row) => [
			row[2],
			row[7],
		]),
		[
			["population", "stored"],
			["population", "stored"],
		],
	);
});

test("bases beside a crosswalk's own do not change the artifact its edges rebuild", (context) => {
	const { path, root, inventory } = fixture(context);
	const database = new DatabaseSync(path);
	const population = Number(
		database
			.prepare(
				"SELECT id FROM crosswalk WHERE slug = 'ward-to-constituency-population'",
			)
			.get()!.id,
	);
	for (const basis of ["postcodes", "households", "dwellings"])
		database
			.prepare(
				`INSERT INTO crosswalk_weight SELECT crosswalk_id, from_version_id, to_version_id, '${basis}', 0.5, 1, 0.5, 0.5 FROM crosswalk_weight WHERE crosswalk_id = ? AND basis_id = 'population'`,
			)
			.run(population);
	database.close();
	for (const entry of inventory.crosswalks)
		assert.deepEqual(
			readCrosswalkById(root, entry, path),
			crosswalks.find((crosswalk) => crosswalk.id === entry.id),
		);
});
