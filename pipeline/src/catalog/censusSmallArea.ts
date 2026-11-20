import { sha256Hex } from "../lib/hash.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	measureSeriesKey,
	rebuildStatisticsObservationText,
	type StatisticsArtifact,
} from "@uk-data-atlas/measures";
import type {
	DatasetCatalogueEntry,
	Measure,
	MeasureSource,
} from "@uk-data-atlas/catalogue/node";
import type { MeasureTableArtifact } from "@uk-data-atlas/catalogue/node";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import {
	CENSUS_BOUNDARY_YEAR,
	CENSUS_PERIOD,
	CENSUS_SMALL_AREA_GEOGRAPHIES,
	CENSUS_SMALL_AREA_TABLES,
	censusTableDirectory,
	type CensusTable,
} from "../statistics/censusSmallAreaSource.ts";
import { censusTableSelector } from "../statistics/selectorPlans.ts";
import { sha256 } from "./values.ts";
import type { CatalogueRows } from "./rows.ts";

const CENSUS_NOTES = [
	"ONS perturbs census cell counts to protect confidentiality, so a count here can differ by a few from the same count in another census table; within this table the categories sum exactly to its total.",
	"The census reports on 2021 statistical geographies, so these partitions are exact on 2021 LSOAs and MSOAs and convert to other geographies only through a published crosswalk.",
];

/** The artifact name each measure of a table partition names. */
export const censusTableArtifactName = (table: string, geography: string) =>
	`census-2021-${table}-${geography}-${CENSUS_BOUNDARY_YEAR}-table`;

export type CensusSmallArea = {
	datasets: DatasetCatalogueEntry[];
	tables: MeasureTableArtifact[];
	/** Measures first published here. */
	measures: Measure[];
	/** Partitions of measures published elsewhere, by measure id. */
	partitions: Map<string, MeasureSource[]>;
};

/**
 * The Census 2021 small-area tables, read from the statistics rows. Each
 * table is rebuilt from its series, and only the lineage of the Nomis files
 * the rows were built from, their size and hash, is read from data/source.
 */
export const compileCensusSmallArea = (
	repositoryRoot: string,
	rows: CatalogueRows,
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
			censusTableDirectory(table.table),
		);
		const datasetId = `census-2021-${table.table}`;
		const terms = rows.datasetTerms(datasetId);
		const measureIds = table.categories.map(
			([suffix]) => `${table.measurePrefix}-${suffix}`,
		);
		const built = CENSUS_SMALL_AREA_GEOGRAPHIES.map((geography) => {
			const file = `census2021-${table.table}-${geography.type}.csv`;
			const content = readFileSync(join(directory, file));
			const artifactId = censusTableArtifactName(
				table.table,
				geography.type,
			);
			const rebuilt = JSON.parse(
				rebuildStatisticsObservationText(
					rows.database,
					censusTableSelector(
						artifactId,
						datasetId,
						geography.type,
						CENSUS_BOUNDARY_YEAR,
						CENSUS_PERIOD,
					)!,
					{} as StatisticsArtifact,
				),
			) as MeasureTableArtifact;
			const { contentHash: _, ...withoutHash } = rebuilt;
			const artifact: MeasureTableArtifact = {
				...withoutHash,
				contentHash: sha256(JSON.stringify(withoutHash)),
			};
			if (artifact.contentHash !== rebuilt.contentHash)
				throw new Error(`${artifactId} was rebuilt with another hash`);
			return {
				geography,
				artifact,
				input: {
					kind: "text",
					path: `${censusTableDirectory(table.table)}/${file}`,
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
			label: terms.title,
			publisher: terms.publisher,
			sourceUrl: terms.url,
			temporalCoverage: CENSUS_PERIOD,
			licence: terms.licence,
			description: terms.description,
			inputs: built.map(({ input }) => input),
			summary: {
				datasetCount: built.length,
				dataRecordCount: built.reduce(
					(count, { artifact }) => count + artifact.records.length,
					0,
				),
				boundaryYears: [CENSUS_BOUNDARY_YEAR],
			},
			compiled: {
				bytes: Buffer.byteLength(compiledContent),
				sha256: sha256Hex(Buffer.from(compiledContent)),
			},
		});
		for (const [
			index,
			[suffix, , label, member],
		] of table.categories.entries()) {
			const measureId = measureIds[index]!;
			const sources = built.map(
				({ geography, artifact }): MeasureSource => ({
					datasetId,
					periods: [CENSUS_PERIOD],
					sourceGeography: {
						type: geography.type,
						boundaryYear: CENSUS_BOUNDARY_YEAR,
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
				series: {
					measure: table.measure,
					dimensions: { [table.dimension]: member ?? suffix },
				},
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
