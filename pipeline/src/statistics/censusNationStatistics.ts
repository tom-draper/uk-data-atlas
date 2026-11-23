import { join } from "node:path";
import { periods, sourceDir } from "@uk-data-atlas/datasets";
import type {
	AreaIndex,
	StatisticsDataset,
	StatisticsInput,
	StatisticsSeries,
} from "@uk-data-atlas/measures";
import { readJsonSync } from "../lib/json.ts";
import {
	CENSUS_NATION_AREAS,
	censusNationRecords,
} from "./censusNationSource.ts";
import {
	CENSUS_NATION_TABLES,
	censusNationMembers,
	type CensusNationTable,
} from "./censusNationTables.ts";
import {
	censusDimensions,
	declared,
	type Meta,
} from "./censusSmallAreaStatistics.ts";

/**
 * The Scotland (2022) and Northern Ireland (2021) census tables as statistics
 * rows: one dataset per table, one series per category on the nation's data
 * zones. Each category is the series of the England and Wales table it joins,
 * so it feeds the same measure; only the dataset, the geography and the census
 * day differ. Like the England and Wales tables, these follow the declared
 * datasets, whose measures and members they share.
 */
export function censusNationStatistics(
	repositoryRoot: string,
	tables: readonly CensusNationTable[] = CENSUS_NATION_TABLES,
): StatisticsInput[] {
	if (tables.length === 0) return [];
	const stored = declared();
	return tables.map((table) => (areas: AreaIndex): StatisticsDataset => {
		const meta = readJsonSync(
			join(
				repositoryRoot,
				"data/source",
				sourceDir(table.folder),
				"meta.json",
			),
		) as Meta;
		const measure = stored.measures.get(table.joins.measure);
		if (!measure)
			throw new Error(
				`${table.dataset}: ${table.joins.measure} is not a stored measure`,
			);
		const members = censusNationMembers(table);
		const period = periods.census(table.year);
		const release = areas.release(
			"dataZone",
			CENSUS_NATION_AREAS[table.nation].boundaryYear,
		);
		const series: StatisticsSeries[] = members.map((each) => ({
			measure: measure.slug,
			release,
			members: each,
		}));
		const dimensions = censusDimensions(
			stored.dimensions,
			members.flatMap((each) => Object.keys(each)),
		);
		const { fingerprint, records } = censusNationRecords(
			repositoryRoot,
			table,
		);
		return {
			slug: table.dataset,
			topic: table.topic,
			...(table.related ? { related: table.related } : {}),
			title: table.title,
			description: table.description,
			source: {
				publisher: meta.publisher,
				url: meta.sourceUrl,
				licence: meta.licence.name,
				...(meta.licence.url ? { licenceUrl: meta.licence.url } : {}),
			},
			fingerprint,
			measures: [measure],
			...(dimensions.length > 0 ? { dimensions } : {}),
			periods: [period],
			series,
			*observations() {
				for (const [code, ...values] of records)
					for (const [column, value] of values.entries())
						yield {
							series: column,
							code,
							period: period.label,
							value,
						};
			},
		};
	});
}
