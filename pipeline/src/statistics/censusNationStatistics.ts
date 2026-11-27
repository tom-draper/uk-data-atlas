import { join } from "node:path";
import {
	periods,
	sourceDir,
	type StatisticsMeasure,
} from "@uk-data-atlas/datasets";
import type {
	AreaIndex,
	StatisticsDataset,
	StatisticsInput,
	StatisticsSeries,
} from "@uk-data-atlas/measures";
import { readJsonSync } from "../lib/json.ts";
import {
	censusNationGeography,
	censusNationRecords,
} from "./censusNationSource.ts";
import {
	CENSUS_NATION_TABLES,
	censusNationMembers,
	censusNationOnlyCategories,
	type CensusNationTable,
} from "./censusNationTables.ts";
import {
	censusDimensions,
	declared,
	type Meta,
} from "./censusSmallAreaStatistics.ts";

/**
 * Each publisher table is a dataset with one count series per category.
 * Matching categories reuse the England and Wales vocabulary. Standalone
 * tables have their own measure and dimension.
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
		const measure: StatisticsMeasure | undefined = table.standalone
			? {
					slug: table.joins.measure,
					label: table.title,
					description: table.description,
					unit: table.joins.unit,
					statistic: "count",
					aggregation: "sum",
				}
			: stored.measures.get(table.joins.measure);
		if (!measure)
			throw new Error(
				`${table.dataset}: ${table.joins.measure} is not a stored measure`,
			);
		const members = censusNationMembers(table);
		const period = periods.census(table.year);
		const { geography, boundaryYear } = censusNationGeography(table);
		const release = areas.release(geography, boundaryYear);
		const series: StatisticsSeries[] = members.map((each) => ({
			measure: measure.slug,
			release,
			members: each,
		}));
		const dimensions = table.standalone
			? [
					{
						slug: table.joins.dimension,
						label: table.title,
						members: table.categories.map(([code, , label]) => ({
							code,
							label: label ?? code,
						})),
					},
				]
			: censusDimensions(
					stored.dimensions,
					members.flatMap((each) => Object.keys(each)),
				);
		if (table.dataset === "census-2021-ni-e15") {
			const tenure = dimensions.find(({ slug }) => slug === "tenure");
			if (!tenure) throw new Error("Census tenure dimension is missing");
			const held = new Set(tenure.members.map(({ code }) => code));
			dimensions[dimensions.indexOf(tenure)] = {
				...tenure,
				members: [
					...tenure.members,
					...censusNationOnlyCategories(table)
						.filter(({ suffix }) => !held.has(suffix))
						.map(({ suffix, label }) => ({ code: suffix, label })),
				],
			};
		}
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
