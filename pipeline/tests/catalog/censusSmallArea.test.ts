import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { measureSeriesKey } from "@uk-data-atlas/measures";
import {
	CENSUS_SMALL_AREA_GEOGRAPHIES,
	CENSUS_SMALL_AREA_TABLES,
	censusTableDirectory,
} from "../../src/statistics/censusSmallAreaSource";
import {
	censusTableArtifactName,
	compileCensusSmallArea,
} from "../../src/catalog/censusSmallArea";
import { fixtureRows, type FixtureSeries } from "./rowFixtures";

const tenure = CENSUS_SMALL_AREA_TABLES.find(
	(table) => table.table === "ts054",
)!;
const ethnicity = CENSUS_SMALL_AREA_TABLES.find(
	(table) => table.table === "ts021",
)!;

const RELEASES = { lsoa: "2021-12-ew-bgc-v5", msoa: "2021-12-ew-bgc-v3" };

/** One series per category of the table, each holding a count of one per area. */
const seriesOf = (
	table: typeof tenure,
	areas: { lsoa: string[]; msoa: string[] },
): FixtureSeries[] =>
	CENSUS_SMALL_AREA_GEOGRAPHIES.flatMap((geography) =>
		table.categories.map(([suffix, , , member]) => ({
			dataset: `census-2021-${table.table}`,
			measure: table.measure,
			geography: geography.type,
			release: RELEASES[geography.type],
			members: { [table.dimension]: member ?? suffix },
			periods: {
				"2021-census": Object.fromEntries(
					areas[geography.type].map((code) => [code, 1]),
				),
			},
		})),
	);

/** A repository whose census folder holds the table's two source files. */
const repository = (table: typeof tenure) => {
	const root = mkdtempSync(join(tmpdir(), "census-small-area-"));
	const directory = join(
		root,
		"data/source",
		censusTableDirectory(table.table),
	);
	mkdirSync(directory, { recursive: true });
	for (const { type } of CENSUS_SMALL_AREA_GEOGRAPHIES)
		writeFileSync(
			join(directory, `census2021-${table.table}-${type}.csv`),
			`date,geography code\n2021,${type}\n`,
		);
	return root;
};

const rowsOf = (table: typeof tenure, areas: Parameters<typeof seriesOf>[1]) =>
	fixtureRows(
		seriesOf(table, areas),
		[],
		[],
		[
			{
				dataset: `census-2021-${table.table}`,
				title: `Fixture ${table.table}`,
				description: "Fixture.",
				publisher: "Office for National Statistics",
				url: "https://www.nomisweb.co.uk/sources/census_2021_bulk",
				licence: "Open Government Licence v3.0",
			},
		],
	);

test("compiles a census table into one shared artifact per small-area geography", () => {
	const root = repository(tenure);
	const rows = rowsOf(tenure, {
		lsoa: ["E01000001", "W01000001"],
		msoa: ["E02000001"],
	});
	try {
		const compiled = compileCensusSmallArea(root, rows, [tenure]);
		const [lsoa, msoa] = compiled.tables;

		assert.equal(lsoa?.id, censusTableArtifactName("ts054", "lsoa"));
		assert.deepEqual(
			lsoa?.measures,
			tenure.categories.map(([suffix, , , member]) =>
				measureSeriesKey({
					measure: tenure.measure,
					dimensions: { [tenure.dimension]: member ?? suffix },
				}),
			),
		);
		assert.deepEqual(
			lsoa?.records.map(([code]) => code),
			["E01000001", "W01000001"],
		);
		assert.equal(msoa?.sourceGeography.type, "msoa");

		const owned = compiled.measures.find(
			(measure) => measure.id === "tenure-owned-outright",
		)!;
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
		assert.equal(compiled.datasets[0]?.label, "Fixture ts054");
		assert.equal(compiled.partitions.size, 0);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rows.close();
	}
});

test("adds a census question already published by authority as partitions of it", () => {
	const root = repository(ethnicity);
	const rows = rowsOf(ethnicity, {
		lsoa: ["E01000001"],
		msoa: ["E02000001"],
	});
	try {
		const compiled = compileCensusSmallArea(root, rows, [ethnicity]);

		assert.deepEqual(compiled.measures, []);
		assert.deepEqual(
			compiled.partitions
				.get("ethnicity-indian")
				?.map((source) => source.sourceGeography.type),
			["lsoa", "msoa"],
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rows.close();
	}
});

test("refuses a dataset the rows do not hold", () => {
	const root = repository(tenure);
	const rows = fixtureRows([]);
	try {
		assert.throws(
			() => compileCensusSmallArea(root, rows, [tenure]),
			/The rows hold no census-2021-ts054 dataset/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rows.close();
	}
});
