import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import {
	buildWeightAtoms,
	readColumn,
	type OutputAreaCounts,
	type PostcodeRow,
} from "../src/crosswalk-weights/atoms";
import { readScottishHouseholds } from "../src/crosswalk-weights/inputs";

const row = (
	outputArea: string,
	overrides: Partial<PostcodeRow> = {},
): PostcodeRow => ({
	postcode: "AB1 1AA",
	terminated: false,
	largeUser: false,
	easting: 400000,
	northing: 300000,
	outputArea,
	...overrides,
});

const counts: OutputAreaCounts = {
	population: new Map([
		["A", 100],
		["B", 60],
		["C", 10],
	]),
	households: new Map([
		["A", 40],
		["B", 20],
		["C", 5],
	]),
	// L2 is suppressed in the source, so it is absent.
	dwellings: new Map([["L1", 120]]),
	lsoaOf: new Map([
		["A", "L1"],
		["B", "L1"],
		["C", "L2"],
	]),
	centroids: new Map([["C", [-1.5, 52.5] as const]]),
};

test("counts are shared between an output area's live small-user postcodes", async () => {
	const atoms = await buildWeightAtoms(
		counts,
		[
			row("A"),
			row("A"),
			row("A", { terminated: true }),
			row("A", { largeUser: true }),
			row("A", { easting: undefined, northing: undefined }),
			row("B"),
		],
		2,
	);
	// Three postcodes and one output area with none (C).
	assert.equal(atoms.count, 4);
	assert.equal(atoms.postcodes, 3);
	assert.deepEqual([...atoms.measures.postcodes], [1, 1, 1, 0]);
	assert.deepEqual([...atoms.measures.population], [50, 50, 60, 10]);
	assert.deepEqual([...atoms.measures.households], [20, 20, 20, 5]);
	// L1's 120 dwellings follow its output areas' households, 40 to 20.
	assert.deepEqual([...atoms.measures.dwellings], [40, 40, 40, 0]);
	assert.ok(atoms.longitude.every(Number.isFinite));
	assert.deepEqual([atoms.longitude[3], atoms.latitude[3]], [-1.5, 52.5]);
	// Everything held reached an atom.
	assert.deepEqual(atoms.totals.population, { held: 170, allocated: 170 });
	assert.deepEqual(atoms.totals.households, { held: 65, allocated: 65 });
	assert.deepEqual(atoms.totals.dwellings, { held: 120, allocated: 120 });
});

test("an output area with no postcode and no centroid keeps its count out", async () => {
	const atoms = await buildWeightAtoms(
		{ ...counts, centroids: new Map() },
		[row("A"), row("B")],
		4,
	);
	assert.equal(atoms.count, 2);
	assert.deepEqual(atoms.totals.population, { held: 170, allocated: 160 });
});

test("a column reads by code, refusing unusable counts unless they are marked", () => {
	const directory = mkdtempSync(join(tmpdir(), "weight-atoms-"));
	try {
		const path = join(directory, "counts.csv");
		writeFileSync(path, '﻿"code","n"\n"A","3"\n"B","[c]"\n');
		assert.throws(() => readColumn(path, "code", "n"), /row 3/);
		assert.deepEqual(
			[...readColumn(path, "code", "n", { skipUnusable: true })],
			[["A", 3]],
		);
		assert.throws(() => readColumn(path, "code", "missing"), /no missing/);
		// Rows of other geographies are not counted.
		writeFileSync(
			path,
			'"kind","code","n"\n"LSOA","A","3"\n"MSOA","M","9"\n"LSOA","B","[z]"\n',
		);
		assert.deepEqual(
			[
				...readColumn(path, "code", "n", {
					skipUnusable: true,
					only: { column: "kind", value: "LSOA" },
				}),
			],
			[["A", 3]],
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("Scottish households are the first count of the household size table", () => {
	const directory = mkdtempSync(join(tmpdir(), "weight-atoms-"));
	try {
		const path = join(directory, "uv406.csv");
		writeFileSync(
			path,
			[
				"Scotland's Census 2022 - National Records of Scotland",
				"Table UV406 - Household size",
				"All occupied household spaces",
				'"","All occupied household spaces","One person","Two people"',
				'"S00135307",62,22,24',
				'"S00135308",-,-,-',
				"",
				"Crown copyright 2024",
			].join("\n"),
		);
		assert.deepEqual(
			[...readScottishHouseholds(path)],
			[
				["S00135307", 62],
				["S00135308", 0],
			],
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
