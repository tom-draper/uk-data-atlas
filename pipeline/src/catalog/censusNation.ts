import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sourceDir } from "@uk-data-atlas/datasets";
import {
	rebuildStatisticsObservationText,
	type StatisticsArtifact,
} from "@uk-data-atlas/measures";
import type {
	DatasetCatalogueEntry,
	Measure,
	MeasureSource,
	MeasureTableArtifact,
} from "@uk-data-atlas/catalogue/node";
import { countriesFor } from "@uk-data-atlas/catalogue/node";
import { sha256Hex } from "../lib/hash.ts";
import { CENSUS_NATION_AREAS } from "../statistics/censusNationSource.ts";
import {
	CENSUS_NATION_TABLES,
	censusNationArtifactName,
	censusNationOnlyCategories,
	type CensusNationTable,
} from "../statistics/censusNationTables.ts";
import { censusTableSelector } from "../statistics/selectorPlans.ts";
import type { CatalogueRows } from "./rows.ts";
import { sha256 } from "./values.ts";

const NATIONS = {
	scotland: {
		name: "Scotland",
		coverage:
			"Scotland's Census 2022 covers all 7,392 data zones in Scotland, counted as at 20 March 2022; England and Wales and Northern Ireland hold their own censuses.",
	},
	"northern-ireland": {
		name: "Northern Ireland",
		coverage:
			"Census 2021 covers all 3,780 data zones in Northern Ireland, counted as at 21 March 2021; England and Wales and Scotland hold their own censuses.",
	},
} as const;

export type CensusNation = {
	datasets: DatasetCatalogueEntry[];
	tables: MeasureTableArtifact[];
};

/**
 * The Scotland and Northern Ireland census tables, read from the statistics
 * rows. Each category is a further source of a measure the England and Wales
 * tables already publish, so its sources are added to `measures`, which must
 * hold every measure the tables join. A category only the nation publishes is
 * a new measure, added to `measures` with the nation as its only source. Only
 * the lineage of the archive the rows were built from, its size and hash, is
 * read from data/source.
 */
export const compileCensusNation = (
	repositoryRoot: string,
	rows: CatalogueRows,
	measures: Measure[],
	tablesToCompile: readonly CensusNationTable[] = CENSUS_NATION_TABLES,
): CensusNation => {
	const datasets: DatasetCatalogueEntry[] = [];
	const tables: MeasureTableArtifact[] = [];
	const inputs = new Map<string, DatasetCatalogueEntry["inputs"][number]>();
	for (const table of tablesToCompile) {
		const { boundaryYear } = CENSUS_NATION_AREAS[table.nation];
		const path = `${sourceDir(table.folder)}/${table.archive}`;
		if (!inputs.has(path)) {
			const content = readFileSync(
				join(repositoryRoot, "data/source", path),
			);
			inputs.set(path, {
				kind: "archive",
				path,
				bytes: content.byteLength,
				sha256: sha256Hex(content),
			});
		}
		const terms = rows.datasetTerms(table.dataset);
		const artifactId = censusNationArtifactName(table, boundaryYear);
		const rebuilt = JSON.parse(
			rebuildStatisticsObservationText(
				rows.database,
				censusTableSelector(
					artifactId,
					table.dataset,
					"dataZone",
					boundaryYear,
					String(table.year),
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
		tables.push(artifact);

		const compiledContent = JSON.stringify(artifact);
		datasets.push({
			id: table.dataset,
			label: terms.title,
			publisher: terms.publisher,
			sourceUrl: terms.url,
			temporalCoverage: String(table.year),
			licence: terms.licence,
			description: terms.description,
			inputs: [inputs.get(path)!],
			summary: {
				datasetCount: 1,
				dataRecordCount: artifact.records.length,
				boundaryYears: [boundaryYear],
			},
			compiled: {
				bytes: Buffer.byteLength(compiledContent),
				sha256: sha256Hex(Buffer.from(compiledContent)),
			},
		});

		const nation = NATIONS[table.nation];
		const source: MeasureSource = {
			datasetId: table.dataset,
			periods: [String(table.year)],
			sourceGeography: { type: "dataZone", boundaryYear },
			observationArtifact: artifact.id,
			coverage: {
				kind: "partial",
				countries: countriesFor(
					artifact.records.map(([areaCode]) => ({ areaCode })),
				),
				recordCount: artifact.records.length,
				note: nation.coverage,
			},
		};
		const only = new Map(
			censusNationOnlyCategories(table).map(({ suffix, label }) => [
				suffix,
				label,
			]),
		);
		for (const [suffix] of table.categories) {
			const measureId = `${table.joins.measurePrefix}-${suffix}`;
			const label = only.get(suffix);
			if (label !== undefined) {
				if (measures.some(({ id }) => id === measureId))
					throw new Error(
						`${table.dataset} publishes ${measureId} on its own, but a census measure has that id.`,
					);
				measures.push({
					id: measureId,
					series: {
						measure: table.joins.measure,
						dimensions: { [table.joins.dimension]: suffix },
					},
					label,
					valueKind: "count",
					unit: table.joins.unit,
					aggregation: {
						kind: "extensive",
						operation: "sum",
						available: true,
					},
					sources: [],
					availability: {
						sourceExact: true,
						conversion: false,
						aggregation: true,
					},
					links: { data: `/v1/data/${measureId}` },
					notes: [table.universe],
				});
			}
			const measure = measures.find(({ id }) => id === measureId);
			if (!measure)
				throw new Error(
					`${table.dataset} joins ${measureId}, which no census measure publishes.`,
				);
			(measure.sources as MeasureSource[]).push(source);
			measure.notes = [
				...(measure.notes ?? []),
				...table.notes.map((note) => `${nation.name}: ${note}`),
			];
		}
	}
	return { datasets, tables };
};
