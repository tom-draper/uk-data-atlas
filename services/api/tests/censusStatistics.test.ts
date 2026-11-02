import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { censusStatistics } from "../../../pipeline/src/censusStatistics";
import type { AreaIndex } from "@uk-data-atlas/atlas-runtime/catalogue";

const table = {
	table: "test",
	measurePrefix: "test",
	unit: "people",
	universe: "People",
	totalColumn: "Total",
	categories: [
		["a", "A", "A"],
		["b", "B", "B"],
		["total", "Total", "Total"],
	],
	notes: [],
} as const;
const areas: AreaIndex = {
	release: (geography, year) => ({ geography, id: `${year}-test` }),
	find: (geography, year) => ({ geography, id: `${year}-test` }),
	has: () => true,
};

test("streams census rows into canonical series for both geographies", () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-census-statistics-"));
	try {
		const dir = join(root, "test");
		mkdirSync(dir);
		writeFileSync(
			join(dir, "meta.json"),
			JSON.stringify({
				title: "Test",
				description: "People",
				publisher: "ONS",
				sourceUrl: "https://example.com",
				licence: { name: "OGL" },
			}),
		);
		const header = '"date","geography","geography code","Total","A","B"\n';
		writeFileSync(
			join(dir, "census2021-test-lsoa.csv"),
			`${header}"2021","area","E01000001",3,1,2\n`,
		);
		writeFileSync(
			join(dir, "census2021-test-msoa.csv"),
			`${header}"2021","area","E02000001",7,3,4\n`,
		);
		const input = censusStatistics(root, [table])[0]!;
		assert.equal(typeof input, "function");
		if (typeof input !== "function")
			throw new Error("Expected a statistics factory");
		const dataset = input(areas);
		assert.equal(dataset.slug, "census-2021-test");
		assert.deepEqual(
			dataset.series.map((series) => series.release.geography),
			["lsoa", "lsoa", "lsoa", "msoa", "msoa", "msoa"],
		);
		assert.deepEqual(
			[...dataset.observations()].map(({ series, code, value }) => ({
				series,
				code,
				value,
			})),
			[
				{ series: 0, code: "E01000001", value: 1 },
				{ series: 1, code: "E01000001", value: 2 },
				{ series: 2, code: "E01000001", value: 3 },
				{ series: 3, code: "E02000001", value: 3 },
				{ series: 4, code: "E02000001", value: 4 },
				{ series: 5, code: "E02000001", value: 7 },
			],
		);
		writeFileSync(
			join(dir, "census2021-test-msoa.csv"),
			`${header}"2021","area","E02000001",8,3,4\n`,
		);
		assert.throws(
			() => [...dataset.observations()],
			/categories do not sum/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
