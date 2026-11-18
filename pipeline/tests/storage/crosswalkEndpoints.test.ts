import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import {
	IdRegistries,
	areaTables,
	crosswalkTables,
	writeSqliteIndex,
} from "../../src/storage/index";
import { closeAllReadOnlyDatabases } from "@uk-data-atlas/atlas-db";

const ward = { geography: "ward", boundaryRelease: "2024" };
const constituency = { geography: "constituency", boundaryRelease: "2024" };

const releases = [
	{ geography: "ward", id: "2024", codes: ["A", "B"] },
	{ geography: "constituency", id: "2024", codes: ["X", "Y"] },
].map(({ geography, id, codes }) => ({
	id,
	geography,
	status: "available" as const,
	recordCount: codes.length,
	artifact: `areas/${geography}/${id}.json`,
	contentHash: `sha256:${geography}-${id}`,
	codeProperty: "code",
	nameProperty: "name",
	codes,
}));

const target = (code: string, population: number) => ({
	code,
	labels: [code],
	weight: 0.5,
	population,
	sourceShare: 0.5,
	targetShare: 0.5,
	overlapAreaM2: 1,
});

/** Population weighted crosswalks from wards to constituencies. */
const crosswalk = (
	id: string,
	records: { source: Record<string, unknown>; targets: unknown[] }[],
) => ({
	schemaVersion: 1,
	id,
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
	contentHash: `sha256:${id}`,
	records,
});

const build = (
	context: { onTestFinished: (run: () => void) => void },
	crosswalks: ReturnType<typeof crosswalk>[],
) => {
	const root = mkdtempSync(join(tmpdir(), "crosswalk-endpoints-"));
	context.onTestFinished(() => {
		closeAllReadOnlyDatabases();
		rmSync(root, { recursive: true, force: true });
	});
	const artifacts = join(root, "data/build/artifacts");
	const write = (path: string, value: unknown) => {
		mkdirSync(join(artifacts, path, ".."), { recursive: true });
		writeFileSync(join(artifacts, path), JSON.stringify(value));
	};
	write("area-inventory.json", {
		schemaVersion: 1,
		contentHash: "sha256:inventory",
		boundaryRegistryHash: "sha256:registry",
		releases: releases.map(({ codes: _codes, ...release }) => release),
	});
	for (const release of releases)
		write(release.artifact, {
			schemaVersion: 1,
			contentHash: release.contentHash,
			areas: release.codes.map((code) => ({ code, name: "Area" })),
		});
	for (const entry of crosswalks) write(`crosswalks/${entry.id}.json`, entry);
	write("crosswalk-inventory.json", {
		schemaVersion: 1,
		contentHash: "sha256:crosswalks",
		crosswalks: crosswalks.map((entry) => ({
			id: entry.id,
			from: entry.from,
			to: entry.to,
			method: entry.method,
			quality: entry.quality,
			weighting: entry.weighting,
			recordCount: entry.records.length,
			artifact: `crosswalks/${entry.id}.json`,
			contentHash: entry.contentHash,
		})),
	});
	const path = join(root, "atlas-base.sqlite");
	const ids = IdRegistries.memory();
	writeSqliteIndex(
		path,
		{},
		{ ...areaTables(artifacts, ids), ...crosswalkTables(artifacts, ids) },
	);
	return path;
};

test("endpoints repeated across crosswalks share one area version and one set of facts", (context) => {
	const path = build(context, [
		crosswalk("first", [
			{
				source: {
					code: "A",
					labels: ["A"],
					population: 90,
					coverage: 1,
				},
				targets: [target("X", 45), target("Z", 45)],
			},
			{
				source: {
					code: "B",
					labels: ["B"],
					population: 10,
					coverage: 1,
				},
				targets: [target("Y", 10)],
			},
		]),
		crosswalk("second", [
			{
				// The same fact again is not a conflict.
				source: {
					code: "A",
					labels: ["A"],
					population: 90,
					coverage: 1,
				},
				targets: [target("X", 45), target("Z", 45)],
			},
		]),
	]);
	const database = new DatabaseSync(path, { readOnly: true });
	context.onTestFinished(() => database.close());
	const rows = (sql: string) =>
		database
			.prepare(sql)
			.all()
			.map((row) => ({ ...row }));
	// Z is in no inventory: it is added once, and found again by the
	// second crosswalk rather than added a second time.
	assert.deepEqual(
		rows(
			"SELECT a.code, v.in_inventory AS inventory FROM area_version v JOIN area a ON a.id = v.area_id WHERE a.code = 'Z'",
		),
		[{ code: "Z", inventory: 0 }],
	);
	assert.deepEqual(
		rows(
			"SELECT a.code, v.population FROM area_version v JOIN area a ON a.id = v.area_id WHERE a.code IN ('A', 'B', 'X') ORDER BY a.code",
		),
		[
			{ code: "A", population: 90 },
			{ code: "B", population: 10 },
			{ code: "X", population: null },
		],
	);
	assert.deepEqual(
		rows(
			"SELECT c.slug, count(*) AS edges FROM crosswalk_edge e JOIN crosswalk c ON c.id = e.crosswalk_id GROUP BY c.slug ORDER BY c.slug",
		),
		[
			{ slug: "first", edges: 3 },
			{ slug: "second", edges: 2 },
		],
	);
});

test("a fact an earlier crosswalk recorded still conflicts with a different one", (context) => {
	assert.throws(
		() =>
			build(context, [
				crosswalk("first", [
					{
						source: {
							code: "A",
							labels: ["A"],
							population: 90,
							coverage: 1,
						},
						targets: [target("X", 90)],
					},
				]),
				crosswalk("second", [
					{
						source: {
							code: "A",
							labels: ["A"],
							population: 91,
							coverage: 1,
						},
						targets: [target("X", 91)],
					},
				]),
			]),
		/Conflicting crosswalk area fact constituency\/.*|Conflicting crosswalk area fact \d+\/A\/population/,
	);
});
