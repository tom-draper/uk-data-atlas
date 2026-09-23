import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	CENSUS_SMALL_AREA_TABLES,
	censusTableArtifactName,
	compileCensusSmallArea,
} from "../src/catalog/censusSmallArea";

const tenure = CENSUS_SMALL_AREA_TABLES.find((table) => table.table === "ts054")!;
const ethnicity = CENSUS_SMALL_AREA_TABLES.find((table) => table.table === "ts021")!;

type Row = { code: string; values: Record<string, number> };

/** A repository whose census folder holds one table's two files. */
const repository = (
	table: typeof tenure,
	rows: { lsoa: Row[]; msoa: Row[] },
) => {
	const root = mkdtempSync(join(tmpdir(), "census-small-area-"));
	const directory = join(root, "data", "demographics", "census-2021-small-area", table.table);
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, "meta.json"),
		JSON.stringify({
			title: `Fixture ${table.table}`,
			description: "Fixture.",
			publisher: "Office for National Statistics",
			sourceUrl: "https://www.nomisweb.co.uk/sources/census_2021_bulk",
			licence: { name: "Open Government Licence v3.0" },
		}),
	);
	const columns = [...new Set([table.totalColumn, ...table.categories.map(([, column]) => column)])];
	for (const geography of ["lsoa", "msoa"] as const) {
		const lines = [
			["date", "geography", "geography code", ...columns],
			...rows[geography].map(({ code, values }) => [
				"2021",
				`Area ${code}`,
				code,
				...columns.map((column) => String(values[column] ?? 0)),
			]),
		].map((fields) => fields.map((field) => JSON.stringify(field)).join(","));
		writeFileSync(join(directory, `census2021-${table.table}-${geography}.csv`), `${lines.join("\n")}\n`);
	}
	return root;
};

/** Every leaf of the table at one, and the total their sum. */
const balanced = (table: typeof tenure, code: string): Row => {
	const leaves = table.categories.filter(([, column]) => column !== table.totalColumn);
	return {
		code,
		values: {
			...Object.fromEntries(leaves.map(([, column]) => [column, 1])),
			[table.totalColumn]: leaves.length,
		},
	};
};

test("compiles a census table into one shared artifact per small-area geography", () => {
	const root = repository(tenure, {
		lsoa: [balanced(tenure, "E01000001"), balanced(tenure, "W01000001")],
		msoa: [balanced(tenure, "E02000001")],
	});
	try {
		const compiled = compileCensusSmallArea(root, [tenure]);
		const [lsoa, msoa] = compiled.tables;

		assert.equal(lsoa?.id, censusTableArtifactName("ts054", "lsoa"));
		assert.deepEqual(lsoa?.measures, tenure.categories.map(([suffix]) => `tenure-${suffix}`));
		assert.deepEqual(lsoa?.records.map(([code]) => code), ["E01000001", "W01000001"]);
		assert.equal(msoa?.sourceGeography.type, "msoa");

		const owned = compiled.measures.find((measure) => measure.id === "tenure-owned-outright")!;
		assert.equal(owned.aggregation.kind, "extensive");
		assert.deepEqual(
			owned.sources.map((source) => [
				source.sourceGeography.type,
				source.observationArtifact,
				source.coverage.countries,
			]),
			[
				["lsoa", lsoa?.id, ["GB-ENG", "GB-WLS"]],
				["msoa", msoa?.id, ["GB-ENG"]],
			],
		);
		assert.deepEqual(compiled.datasets[0]?.summary, {
			datasetCount: 2,
			dataRecordCount: 3,
			boundaryYears: [2021],
		});
		assert.equal(compiled.partitions.size, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("adds a census question already published by authority as partitions of it", () => {
	const root = repository(ethnicity, {
		lsoa: [balanced(ethnicity, "E01000001")],
		msoa: [balanced(ethnicity, "E02000001")],
	});
	try {
		const compiled = compileCensusSmallArea(root, [ethnicity]);

		assert.deepEqual(compiled.measures, []);
		assert.deepEqual(
			compiled.partitions.get("ethnicity-indian")?.map((source) => source.sourceGeography.type),
			["lsoa", "msoa"],
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("refuses a file whose categories do not make up its total, or whose codes are wrong", () => {
	const unbalanced = balanced(tenure, "E01000001");
	unbalanced.values[tenure.totalColumn] = 1;
	for (const [rows, message] of [
		[{ lsoa: [unbalanced], msoa: [] }, /categories sum to 8, not the total 1/],
		[{ lsoa: [balanced(tenure, "E02000001")], msoa: [] }, /E02000001 is not a 2021 LSOAs code/],
		[
			{ lsoa: [balanced(tenure, "E01000001"), balanced(tenure, "E01000001")], msoa: [] },
			/E01000001 repeats/,
		],
	] as const) {
		const root = repository(tenure, rows);
		try {
			assert.throws(() => compileCensusSmallArea(root, [tenure]), message);
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	}
});
