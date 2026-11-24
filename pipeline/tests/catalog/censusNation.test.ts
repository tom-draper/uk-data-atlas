import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import { sourceDir } from "@uk-data-atlas/datasets";
import type { Measure, MeasureSource } from "@uk-data-atlas/catalogue/node";
import { compileCensusNation } from "../../src/catalog/censusNation";
import {
	CENSUS_NATION_TABLES,
	censusNationArtifactName,
} from "../../src/statistics/censusNationTables";
import { fixtureRows } from "./rowFixtures";

const households = CENSUS_NATION_TABLES.find(
	(table) => table.dataset === "census-2021-ni-e01",
)!;

/** A repository whose census folder holds the table's archive. */
const repository = () => {
	const root = mkdtempSync(join(tmpdir(), "census-nation-"));
	const directory = join(root, "data/source", sourceDir(households.folder));
	mkdirSync(directory, { recursive: true });
	writeFileSync(join(directory, households.archive), "archive");
	return root;
};

const measure = (id: string) =>
	({
		id,
		sources: [] as MeasureSource[],
		notes: ["England and Wales note."],
	}) as unknown as Measure;

const rowsOf = () =>
	fixtureRows(
		[
			{
				dataset: households.dataset,
				measure: households.joins.measure,
				geography: "dataZone",
				release: "2021-ni-dz",
				members: { [households.joins.dimension]: "total" },
				periods: { "2021-census": { N20000001: 10, N20000002: 20 } },
			},
		],
		[],
		[],
		[
			{
				dataset: households.dataset,
				title: "Fixture households",
				description: "Fixture.",
				publisher: "Northern Ireland Statistics and Research Agency",
				url: "https://www.nisra.gov.uk/publications/census-2021-bulk-download",
				licence: "Open Government Licence v3.0",
			},
		],
	);

test("adds a nation table as a further source of the measure it joins", () => {
	const root = repository();
	const rows = rowsOf();
	const target = measure(`${households.joins.measurePrefix}-total`);
	try {
		const compiled = compileCensusNation(
			root,
			rows,
			[target],
			[households],
		);

		const [artifact] = compiled.tables;
		assert.equal(artifact?.id, censusNationArtifactName(households, 2021));
		assert.deepEqual(
			artifact?.records.map(([code]) => code),
			["N20000001", "N20000002"],
		);

		assert.deepEqual(
			target.sources.map((source) => [
				source.datasetId,
				source.periods,
				source.sourceGeography,
				source.observationArtifact,
				source.coverage.countries,
			]),
			[
				[
					households.dataset,
					["2021"],
					{ type: "dataZone", boundaryYear: 2021 },
					artifact?.id,
					["GB-NIR"],
				],
			],
		);
		assert.equal(target.notes?.[0], "England and Wales note.");
		assert.match(target.notes!.at(-1)!, /^Northern Ireland: /);

		const [dataset] = compiled.datasets;
		assert.equal(dataset?.id, households.dataset);
		assert.equal(dataset?.label, "Fixture households");
		assert.equal(dataset?.temporalCoverage, "2021");
		assert.deepEqual(dataset?.summary, {
			datasetCount: 1,
			dataRecordCount: 2,
			boundaryYears: [2021],
		});
		assert.equal(dataset?.inputs[0]?.kind, "archive");
		assert.equal(
			dataset?.inputs[0]?.path,
			`${sourceDir(households.folder)}/${households.archive}`,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rows.close();
	}
});

test("refuses a table whose measure no census table publishes", () => {
	const root = repository();
	const rows = rowsOf();
	try {
		assert.throws(
			() => compileCensusNation(root, rows, [], [households]),
			/which no census measure publishes/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rows.close();
	}
});

test("publishes a category only the nation counts as a measure of its own", () => {
	const root = repository();
	const rows = rowsOf();
	const own = {
		...households,
		categories: [["one-or-more-people", "All households", "Fixture own"]],
	} as unknown as typeof households;
	const measures: Measure[] = [];
	try {
		const compiled = compileCensusNation(root, rows, measures, [own]);
		const [created] = measures;
		assert.equal(
			created?.id,
			`${own.joins.measurePrefix}-one-or-more-people`,
		);
		assert.equal(created?.label, "Fixture own");
		assert.deepEqual(created?.series, {
			measure: own.joins.measure,
			dimensions: { [own.joins.dimension]: "one-or-more-people" },
		});
		assert.equal(created?.unit, own.joins.unit);
		assert.deepEqual(
			created?.sources.map((source) => source.observationArtifact),
			[compiled.tables[0]?.id],
		);
		assert.equal(created?.notes?.[0], own.universe);
		assert.match(created!.notes!.at(-1)!, /^Northern Ireland: /);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rows.close();
	}
});

test("refuses a category of the nation's own whose measure already exists", () => {
	const root = repository();
	const rows = rowsOf();
	const own = {
		...households,
		categories: [["total", "All households", "Fixture own"]],
	} as unknown as typeof households;
	try {
		assert.throws(
			() =>
				compileCensusNation(
					root,
					rows,
					[measure(`${own.joins.measurePrefix}-total`)],
					[own],
				),
			/a census measure has that id/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
		rows.close();
	}
});
