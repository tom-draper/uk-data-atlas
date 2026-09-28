import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	DatasetCatalogueEntry,
	Measure,
	MeasureSource,
	SourceGeography,
} from "../dataCatalog";
import type { MeasureTableArtifact } from "../observationTables";
import { csvFields } from "../populationOverlap";
import { countriesFor } from "./countries";
import { sha256 } from "./values";

/**
 * Census 2021 tables for England and Wales at the two statistical small-area
 * geographies, read from the Nomis bulk files kept unchanged under
 * data/demographics/census-2021-small-area.
 *
 * Each category is a count, so it adds over areas and converts exactly
 * through a containment crosswalk. Only leaf categories are served, which
 * together make up the table's total: a subtotal would be the sum of its
 * leaves, and a caller who wants one can aggregate them without the risk of
 * adding a subtotal to its own parts.
 */
type Category = readonly [suffix: string, column: string, label: string];

export type CensusTable = {
	table: string;
	/** The measure id is the prefix and the category suffix. */
	measurePrefix: string;
	unit: string;
	universe: string;
	totalColumn: string;
	categories: readonly Category[];
	notes: readonly string[];
	/**
	 * Measures published elsewhere for the same census question, which these
	 * partitions extend rather than duplicate.
	 */
	extendsExistingMeasures?: boolean;
};

const HEADER = ["date", "geography", "geography code"];

const CENSUS_NOTES = [
	"ONS perturbs census cell counts to protect confidentiality, so a count here can differ by a few from the same count in another census table; within this table the categories sum exactly to its total.",
	"The census reports on 2021 statistical geographies, so these partitions are exact on 2021 LSOAs and MSOAs and convert to other geographies only through a published crosswalk.",
];

export const CENSUS_SMALL_AREA_TABLES: readonly CensusTable[] = [
	{
		table: "ts001",
		measurePrefix: "usual-residents",
		unit: "usual residents",
		universe:
			"All usual residents on Census Day, 21 March 2021, whether they lived in a household or a communal establishment.",
		totalColumn: "Residence type: Total; measures: Value",
		categories: [
			[
				"in-households",
				"Residence type: Lives in a household; measures: Value",
				"Usual residents living in households",
			],
			[
				"in-communal-establishments",
				"Residence type: Lives in a communal establishment; measures: Value",
				"Usual residents living in communal establishments",
			],
			[
				"total",
				"Residence type: Total; measures: Value",
				"Usual residents",
			],
		],
		notes: [
			"A census count of usual residents on Census Day, not a mid-year population estimate; the two differ in date and method.",
			"Communal establishments include care homes, student halls, prisons and armed forces bases.",
		],
	},
	{
		table: "ts007a",
		measurePrefix: "age",
		unit: "usual residents",
		universe: "All usual residents, by age on Census Day.",
		totalColumn: "Age: Total",
		categories: [
			["0-to-4", "Age: Aged 4 years and under", "Aged 4 and under"],
			["5-to-9", "Age: Aged 5 to 9 years", "Aged 5 to 9"],
			["10-to-14", "Age: Aged 10 to 14 years", "Aged 10 to 14"],
			["15-to-19", "Age: Aged 15 to 19 years", "Aged 15 to 19"],
			["20-to-24", "Age: Aged 20 to 24 years", "Aged 20 to 24"],
			["25-to-29", "Age: Aged 25 to 29 years", "Aged 25 to 29"],
			["30-to-34", "Age: Aged 30 to 34 years", "Aged 30 to 34"],
			["35-to-39", "Age: Aged 35 to 39 years", "Aged 35 to 39"],
			["40-to-44", "Age: Aged 40 to 44 years", "Aged 40 to 44"],
			["45-to-49", "Age: Aged 45 to 49 years", "Aged 45 to 49"],
			["50-to-54", "Age: Aged 50 to 54 years", "Aged 50 to 54"],
			["55-to-59", "Age: Aged 55 to 59 years", "Aged 55 to 59"],
			["60-to-64", "Age: Aged 60 to 64 years", "Aged 60 to 64"],
			["65-to-69", "Age: Aged 65 to 69 years", "Aged 65 to 69"],
			["70-to-74", "Age: Aged 70 to 74 years", "Aged 70 to 74"],
			["75-to-79", "Age: Aged 75 to 79 years", "Aged 75 to 79"],
			["80-to-84", "Age: Aged 80 to 84 years", "Aged 80 to 84"],
			["85-plus", "Age: Aged 85 years and over", "Aged 85 and over"],
		],
		notes: [
			"Five-year bands; a wider band, such as 65 and over, is the sum of its bands and adds exactly.",
		],
	},
	{
		table: "ts003",
		measurePrefix: "household-composition",
		unit: "households",
		universe: "Households, not people: each household counts once.",
		totalColumn: "Household composition: Total; measures: Value",
		categories: [
			[
				"one-person-66-plus",
				"Household composition: One person household: Aged 66 years and over; measures: Value",
				"One-person household aged 66 or over",
			],
			[
				"one-person-other",
				"Household composition: One person household: Other; measures: Value",
				"One-person household, other",
			],
			[
				"family-all-66-plus",
				"Household composition: Single family household: All aged 66 years and over; measures: Value",
				"Single family household, all aged 66 or over",
			],
			[
				"married-no-children",
				"Household composition: Single family household: Married or civil partnership couple: No children; measures: Value",
				"Married or civil partnership couple, no children",
			],
			[
				"married-dependent-children",
				"Household composition: Single family household: Married or civil partnership couple: Dependent children; measures: Value",
				"Married or civil partnership couple, dependent children",
			],
			[
				"married-non-dependent-children",
				"Household composition: Single family household: Married or civil partnership couple: All children non-dependent; measures: Value",
				"Married or civil partnership couple, all children non-dependent",
			],
			[
				"cohabiting-no-children",
				"Household composition: Single family household: Cohabiting couple family: No children; measures: Value",
				"Cohabiting couple, no children",
			],
			[
				"cohabiting-dependent-children",
				"Household composition: Single family household: Cohabiting couple family: With dependent children; measures: Value",
				"Cohabiting couple, dependent children",
			],
			[
				"cohabiting-non-dependent-children",
				"Household composition: Single family household: Cohabiting couple family: All children non-dependent; measures: Value",
				"Cohabiting couple, all children non-dependent",
			],
			[
				"lone-parent-dependent-children",
				"Household composition: Single family household: Lone parent family: With dependent children; measures: Value",
				"Lone parent, dependent children",
			],
			[
				"lone-parent-non-dependent-children",
				"Household composition: Single family household: Lone parent family: All children non-dependent; measures: Value",
				"Lone parent, all children non-dependent",
			],
			[
				"other-family",
				"Household composition: Single family household: Other single family household: Other family composition; measures: Value",
				"Other single family household",
			],
			[
				"other-with-dependent-children",
				"Household composition: Other household types: With dependent children; measures: Value",
				"Other household type with dependent children",
			],
			[
				"other",
				"Household composition: Other household types: Other, including all full-time students and all aged 66 years and over; measures: Value",
				"Other household type, including all full-time students",
			],
			[
				"total",
				"Household composition: Total; measures: Value",
				"Households",
			],
		],
		notes: [
			"A dependent child is aged 0 to 15, or 16 to 18 in full-time education and living with a parent.",
		],
	},
	{
		table: "ts054",
		measurePrefix: "tenure",
		unit: "households",
		universe: "Households, not people: each household counts once.",
		totalColumn: "Tenure of household: Total: All households",
		categories: [
			[
				"owned-outright",
				"Tenure of household: Owned: Owns outright",
				"Owned outright",
			],
			[
				"owned-with-mortgage",
				"Tenure of household: Owned: Owns with a mortgage or loan",
				"Owned with a mortgage or loan",
			],
			[
				"shared-ownership",
				"Tenure of household: Shared ownership: Shared ownership",
				"Shared ownership",
			],
			[
				"social-rented-council",
				"Tenure of household: Social rented: Rents from council or Local Authority",
				"Social rented from a council",
			],
			[
				"social-rented-other",
				"Tenure of household: Social rented: Other social rented",
				"Other social rented",
			],
			[
				"private-rented-landlord",
				"Tenure of household: Private rented: Private landlord or letting agency",
				"Private rented from a landlord or letting agency",
			],
			[
				"private-rented-other",
				"Tenure of household: Private rented: Other private rented",
				"Other private rented",
			],
			[
				"rent-free",
				"Tenure of household: Lives rent free",
				"Lives rent free",
			],
			[
				"total",
				"Tenure of household: Total: All households",
				"Households",
			],
		],
		notes: [
			"Social rented includes housing associations as well as councils; owned covers owned outright and with a mortgage, not shared ownership.",
		],
	},
	{
		table: "ts066",
		measurePrefix: "economic-activity",
		unit: "usual residents aged 16 and over",
		universe:
			"Usual residents aged 16 and over, by their activity in the week before Census Day.",
		totalColumn:
			"Economic activity status: Total: All usual residents aged 16 years and over",
		categories: [
			[
				"employed",
				"Economic activity status: Economically active (excluding full-time students):In employment",
				"In employment, excluding full-time students",
			],
			[
				"unemployed",
				"Economic activity status: Economically active (excluding full-time students): Unemployed",
				"Unemployed, excluding full-time students",
			],
			[
				"student-employed",
				"Economic activity status: Economically active and a full-time student:In employment",
				"Full-time student in employment",
			],
			[
				"student-unemployed",
				"Economic activity status: Economically active and a full-time student: Unemployed",
				"Full-time student, unemployed",
			],
			[
				"inactive-retired",
				"Economic activity status: Economically inactive: Retired",
				"Economically inactive: retired",
			],
			[
				"inactive-student",
				"Economic activity status: Economically inactive: Student",
				"Economically inactive: student",
			],
			[
				"inactive-looking-after-home",
				"Economic activity status: Economically inactive: Looking after home or family",
				"Economically inactive: looking after home or family",
			],
			[
				"inactive-long-term-sick",
				"Economic activity status: Economically inactive: Long-term sick or disabled",
				"Economically inactive: long-term sick or disabled",
			],
			[
				"inactive-other",
				"Economic activity status: Economically inactive: Other",
				"Economically inactive: other",
			],
			[
				"total",
				"Economic activity status: Total: All usual residents aged 16 years and over",
				"Usual residents aged 16 and over",
			],
		],
		notes: [
			"Census Day fell in a national lockdown, so employment in some sectors reads differently from other years.",
			"Full-time students who worked or looked for work are economically active; the census keeps them apart from other active residents, as here.",
			"An unemployment rate is unemployed over economically active, not over all residents; both are served, so a caller chooses the denominator.",
		],
	},
	{
		table: "ts021",
		measurePrefix: "ethnicity",
		unit: "usual residents",
		universe:
			"All usual residents, as they identified themselves. The nineteen categories are exhaustive, so they sum to the whole resident population.",
		totalColumn: "Ethnic group: Total: All usual residents",
		extendsExistingMeasures: true,
		categories: [
			[
				"bangladeshi",
				"Ethnic group: Asian, Asian British or Asian Welsh: Bangladeshi",
				"Ethnic group: Bangladeshi",
			],
			[
				"chinese",
				"Ethnic group: Asian, Asian British or Asian Welsh: Chinese",
				"Ethnic group: Chinese",
			],
			[
				"indian",
				"Ethnic group: Asian, Asian British or Asian Welsh: Indian",
				"Ethnic group: Indian",
			],
			[
				"pakistani",
				"Ethnic group: Asian, Asian British or Asian Welsh: Pakistani",
				"Ethnic group: Pakistani",
			],
			[
				"other-asian",
				"Ethnic group: Asian, Asian British or Asian Welsh: Other Asian",
				"Ethnic group: Other Asian",
			],
			[
				"african",
				"Ethnic group: Black, Black British, Black Welsh, Caribbean or African: African",
				"Ethnic group: African",
			],
			[
				"caribbean",
				"Ethnic group: Black, Black British, Black Welsh, Caribbean or African: Caribbean",
				"Ethnic group: Caribbean",
			],
			[
				"other-black",
				"Ethnic group: Black, Black British, Black Welsh, Caribbean or African: Other Black",
				"Ethnic group: Other Black",
			],
			[
				"white-and-asian",
				"Ethnic group: Mixed or Multiple ethnic groups: White and Asian",
				"Ethnic group: White and Asian",
			],
			[
				"white-and-black-african",
				"Ethnic group: Mixed or Multiple ethnic groups: White and Black African",
				"Ethnic group: White and Black African",
			],
			[
				"white-and-black-caribbean",
				"Ethnic group: Mixed or Multiple ethnic groups: White and Black Caribbean",
				"Ethnic group: White and Black Caribbean",
			],
			[
				"other-mixed",
				"Ethnic group: Mixed or Multiple ethnic groups: Other Mixed or Multiple ethnic groups",
				"Ethnic group: Other Mixed or Multiple ethnic groups",
			],
			[
				"white-british",
				"Ethnic group: White: English, Welsh, Scottish, Northern Irish or British",
				"Ethnic group: English, Welsh, Scottish, Northern Irish or British",
			],
			["irish", "Ethnic group: White: Irish", "Ethnic group: Irish"],
			[
				"gypsy-or-irish-traveller",
				"Ethnic group: White: Gypsy or Irish Traveller",
				"Ethnic group: Gypsy or Irish Traveller",
			],
			["roma", "Ethnic group: White: Roma", "Ethnic group: Roma"],
			[
				"other-white",
				"Ethnic group: White: Other White",
				"Ethnic group: Other White",
			],
			[
				"arab",
				"Ethnic group: Other ethnic group: Arab",
				"Ethnic group: Arab",
			],
			[
				"any-other",
				"Ethnic group: Other ethnic group: Any other ethnic group",
				"Ethnic group: Any other ethnic group",
			],
		],
		notes: [],
	},
	{
		table: "ts037",
		measurePrefix: "general-health",
		unit: "usual residents",
		universe:
			"All usual residents, by their own assessment of their general health.",
		totalColumn: "General health: Total: All usual residents",
		categories: [
			[
				"very-good",
				"General health: Very good health",
				"General health: very good",
			],
			["good", "General health: Good health", "General health: good"],
			["fair", "General health: Fair health", "General health: fair"],
			["bad", "General health: Bad health", "General health: bad"],
			[
				"very-bad",
				"General health: Very bad health",
				"General health: very bad",
			],
			[
				"total",
				"General health: Total: All usual residents",
				"Usual residents",
			],
		],
		notes: [
			"Self-assessed on a five-point scale; it is not a clinical measure and was collected during the pandemic.",
		],
	},
];

const GEOGRAPHIES = [
	{ type: "lsoa", prefixes: ["E01", "W01"], label: "2021 LSOAs" },
	{ type: "msoa", prefixes: ["E02", "W02"], label: "2021 MSOAs" },
] as const satisfies ReadonlyArray<{
	type: SourceGeography["type"];
	prefixes: readonly string[];
	label: string;
}>;

const BOUNDARY_YEAR = 2021;
const PERIOD = "2021";
const DATA_DIRECTORY = "demographics/census-2021-small-area";

const fileSha256 = (content: Buffer) =>
	createHash("sha256").update(content).digest("hex");

/** The artifact name each measure of a table partition names. */
export const censusTableArtifactName = (table: string, geography: string) =>
	`census-2021-${table}-${geography}-${BOUNDARY_YEAR}-table`;

const tableRecords = (
	path: string,
	table: CensusTable,
	geography: (typeof GEOGRAPHIES)[number],
) => {
	const lines = readFileSync(path, "utf8")
		.replace(/^﻿/, "")
		.split(/\r?\n/)
		.filter((line) => line.length > 0);
	const header = csvFields(lines[0] ?? "");
	if (HEADER.some((name, index) => header[index] !== name))
		throw new Error(`${path}: expected ${HEADER.join(", ")} first`);
	const columnOf = (name: string) => {
		const index = header.indexOf(name);
		if (index === -1) throw new Error(`${path}: no column ${name}`);
		return index;
	};
	const total = columnOf(table.totalColumn);
	const columns = table.categories.map(([, column]) => columnOf(column));
	// The leaves are the categories other than the total, which they make up.
	const leaves = table.categories.flatMap(([, column], index) =>
		column === table.totalColumn ? [] : [columns[index]!],
	);
	const seen = new Set<string>();
	return lines.slice(1).map((line, index) => {
		const fields = csvFields(line);
		const code = fields[2] ?? "";
		const where = `${path} row ${index + 2}`;
		if (fields[0] !== PERIOD)
			throw new Error(`${where}: date is ${fields[0]}, not ${PERIOD}`);
		if (!geography.prefixes.some((prefix) => code.startsWith(prefix)))
			throw new Error(
				`${where}: ${code} is not a ${geography.label} code`,
			);
		if (seen.has(code)) throw new Error(`${where}: ${code} repeats`);
		seen.add(code);
		const value = (column: number) => {
			const parsed = Number(fields[column]);
			if (!Number.isInteger(parsed) || parsed < 0)
				throw new Error(`${where}: ${header[column]} is not a count`);
			return parsed;
		};
		const sum = leaves.reduce(
			(running, column) => running + value(column),
			0,
		);
		if (sum !== value(total))
			throw new Error(
				`${where}: the categories sum to ${sum}, not the total ${value(total)}`,
			);
		return [code, ...columns.map(value)] as [string, ...number[]];
	});
};

export type CensusSmallArea = {
	datasets: DatasetCatalogueEntry[];
	tables: MeasureTableArtifact[];
	/** Measures first published here. */
	measures: Measure[];
	/** Partitions of measures published elsewhere, by measure id. */
	partitions: Map<string, MeasureSource[]>;
};

export const compileCensusSmallArea = (
	repositoryRoot: string,
	tablesToCompile: readonly CensusTable[] = CENSUS_SMALL_AREA_TABLES,
): CensusSmallArea => {
	const datasets: DatasetCatalogueEntry[] = [];
	const tables: MeasureTableArtifact[] = [];
	const measures: Measure[] = [];
	const partitions = new Map<string, MeasureSource[]>();
	for (const table of tablesToCompile) {
		const directory = join(
			repositoryRoot,
			"data",
			DATA_DIRECTORY,
			table.table,
		);
		const meta = JSON.parse(
			readFileSync(join(directory, "meta.json"), "utf8"),
		) as {
			title: string;
			description: string;
			publisher: string;
			sourceUrl: string;
			licence: { name: string; url?: string };
		};
		const datasetId = `census-2021-${table.table}`;
		const measureIds = table.categories.map(
			([suffix]) => `${table.measurePrefix}-${suffix}`,
		);
		const built = GEOGRAPHIES.map((geography) => {
			const file = `census2021-${table.table}-${geography.type}.csv`;
			const content = readFileSync(join(directory, file));
			const records = tableRecords(
				join(directory, file),
				table,
				geography,
			);
			const withoutHash = {
				schemaVersion: 1 as const,
				kind: "measure-table" as const,
				id: censusTableArtifactName(table.table, geography.type),
				datasetId,
				sourceGeography: {
					type: geography.type,
					boundaryYear: BOUNDARY_YEAR,
				},
				period: PERIOD,
				measures: measureIds,
				records,
			};
			const artifact: MeasureTableArtifact = {
				...withoutHash,
				contentHash: sha256(JSON.stringify(withoutHash)),
			};
			return {
				geography,
				artifact,
				input: {
					kind: "text",
					path: `${DATA_DIRECTORY}/${table.table}/${file}`,
					bytes: content.byteLength,
					sha256: fileSha256(content),
				},
			};
		});
		tables.push(...built.map(({ artifact }) => artifact));
		const compiledContent = built
			.map(({ artifact }) => JSON.stringify(artifact))
			.join("\n");
		datasets.push({
			id: datasetId,
			label: meta.title,
			publisher: meta.publisher,
			sourceUrl: meta.sourceUrl,
			temporalCoverage: PERIOD,
			licence: meta.licence,
			description: meta.description,
			inputs: built.map(({ input }) => input),
			summary: {
				datasetCount: built.length,
				dataRecordCount: built.reduce(
					(count, { artifact }) => count + artifact.records.length,
					0,
				),
				boundaryYears: [BOUNDARY_YEAR],
			},
			compiled: {
				bytes: Buffer.byteLength(compiledContent),
				sha256: fileSha256(Buffer.from(compiledContent)),
			},
		});
		for (const [index, [, , label]] of table.categories.entries()) {
			const measureId = measureIds[index]!;
			const sources = built.map(
				({ geography, artifact }): MeasureSource => ({
					datasetId,
					periods: [PERIOD],
					sourceGeography: {
						type: geography.type,
						boundaryYear: BOUNDARY_YEAR,
					},
					observationArtifact: artifact.id,
					coverage: {
						kind: "partial",
						countries: countriesFor(
							artifact.records.map(([areaCode]) => ({
								areaCode,
							})),
						),
						recordCount: artifact.records.length,
						note: `Census 2021 covers every ${geography.label.slice(5)} in England and Wales; Scotland and Northern Ireland hold their own censuses on other geographies.`,
					},
				}),
			);
			if (table.extendsExistingMeasures) {
				partitions.set(measureId, sources);
				continue;
			}
			measures.push({
				id: measureId,
				label,
				valueKind: "count",
				unit: table.unit,
				aggregation: {
					kind: "extensive",
					operation: "sum",
					available: true,
				},
				sources,
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: true,
				},
				links: { data: `/v1/data/${measureId}` },
				notes: [table.universe, ...table.notes, ...CENSUS_NOTES],
			});
		}
	}
	return { datasets, tables, measures, partitions };
};
