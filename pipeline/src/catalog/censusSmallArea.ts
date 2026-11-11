import { sha256Hex } from "../lib/hash.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	DatasetCatalogueEntry,
	Measure,
	MeasureSource,
	SourceGeography,
} from "@uk-data-atlas/catalogue/node";
import type { MeasureTableArtifact } from "@uk-data-atlas/catalogue/node";
import { csvFields } from "@uk-data-atlas/artifacts";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import { sha256 } from "./values.ts";
import { readJsonSync } from "../lib/json.ts";

import {
	CENSUS_SMALL_AREA_TABLES,
	type CensusTable,
} from "./censusSmallAreaTables.ts";

export { CENSUS_SMALL_AREA_TABLES, type CensusTable };

const HEADER = ["date", "geography", "geography code"];

const CENSUS_NOTES = [
	"ONS perturbs census cell counts to protect confidentiality, so a count here can differ by a few from the same count in another census table; within this table the categories sum exactly to its total.",
	"The census reports on 2021 statistical geographies, so these partitions are exact on 2021 LSOAs and MSOAs and convert to other geographies only through a published crosswalk.",
];

export const CENSUS_SMALL_AREA_GEOGRAPHIES = [
	{ type: "lsoa", prefixes: ["E01", "W01"], label: "2021 LSOAs" },
	{ type: "msoa", prefixes: ["E02", "W02"], label: "2021 MSOAs" },
] as const satisfies ReadonlyArray<{
	type: SourceGeography["type"];
	prefixes: readonly string[];
	label: string;
}>;

const BOUNDARY_YEAR = 2021;
const PERIOD = "2021";
export const CENSUS_SMALL_AREA_DIRECTORY =
	"demographics/census-2021-small-area";

/** The artifact name each measure of a table partition names. */
export const censusTableArtifactName = (table: string, geography: string) =>
	`census-2021-${table}-${geography}-${BOUNDARY_YEAR}-table`;

/**
 * A table's rows for one geography, in area code order, as an area code and
 * a count per category in the table's category order, checked to add to the
 * total.
 */
export const censusTableRecords = (
	path: string,
	table: CensusTable,
	geography: (typeof CENSUS_SMALL_AREA_GEOGRAPHIES)[number],
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
	return (
		lines
			.slice(1)
			.map((line, index) => {
				const fields = csvFields(line);
				const code = fields[2] ?? "";
				const where = `${path} row ${index + 2}`;
				if (fields[0] !== PERIOD)
					throw new Error(
						`${where}: date is ${fields[0]}, not ${PERIOD}`,
					);
				if (
					!geography.prefixes.some((prefix) =>
						code.startsWith(prefix),
					)
				)
					throw new Error(
						`${where}: ${code} is not a ${geography.label} code`,
					);
				if (seen.has(code))
					throw new Error(`${where}: ${code} repeats`);
				seen.add(code);
				const value = (column: number) => {
					const parsed = Number(fields[column]);
					if (!Number.isInteger(parsed) || parsed < 0)
						throw new Error(
							`${where}: ${header[column]} is not a count`,
						);
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
			})
			// In area code order, as every other observation artifact is, so a
			// table rebuilt from statistics rows has the same bytes.
			.sort(([left], [right]) =>
				left < right ? -1 : left > right ? 1 : 0,
			)
	);
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
			"data/source",
			CENSUS_SMALL_AREA_DIRECTORY,
			table.table,
		);
		const meta = readJsonSync(join(directory, "meta.json")) as {
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
		const built = CENSUS_SMALL_AREA_GEOGRAPHIES.map((geography) => {
			const file = `census2021-${table.table}-${geography.type}.csv`;
			const content = readFileSync(join(directory, file));
			const records = censusTableRecords(
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
					path: `${CENSUS_SMALL_AREA_DIRECTORY}/${table.table}/${file}`,
					bytes: content.byteLength,
					sha256: sha256Hex(content),
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
				sha256: sha256Hex(Buffer.from(compiledContent)),
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
						note: `Census 2021 covers all ${geography.label} in England and Wales; Scotland and Northern Ireland hold their own censuses on other geographies.`,
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
