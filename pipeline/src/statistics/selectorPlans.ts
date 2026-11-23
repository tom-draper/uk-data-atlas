import {
	measureSeriesKey,
	type StatisticsSelector,
	type StatisticsTableSelector,
} from "@uk-data-atlas/measures";
import {
	CENSUS_NATION_TABLES,
	censusNationMembers,
} from "./censusNationTables.ts";
import { CENSUS_SMALL_AREA_TABLES } from "./censusSmallAreaSource.ts";

const PARTITION_BY_CODE_YEAR = new Set([
	"car-availability",
	"claimant-count",
	"ethnicity",
	"income",
	"qualification",
	"travel-to-work",
	"unemployment",
	"workplace-income",
]);

/** A catalogue partition that deliberately serves only its code year's areas. */
export function partitionByCodeYear(
	selector: StatisticsSelector,
	datasetId: string,
	releases: readonly string[],
): StatisticsSelector {
	return selector.geography === "localAuthority" &&
		PARTITION_BY_CODE_YEAR.has(datasetId) &&
		releases.length
		? { ...selector, areasIn: [...releases] }
		: selector;
}

/** The common selector for all measures in one published census table. */
export function censusTableSelector(
	name: string,
	datasetId: string,
	geography: string,
	boundaryYear: number,
	period: string,
): StatisticsTableSelector | undefined {
	const nation = CENSUS_NATION_TABLES.find(
		(table) => datasetId === table.dataset,
	);
	const census = CENSUS_SMALL_AREA_TABLES.find(
		(table) => datasetId === `census-2021-${table.table}`,
	);
	const columns = nation
		? censusNationMembers(nation).map((dimensions) => ({
				measure: nation.joins.measure,
				dimensions,
			}))
		: census?.categories.map(([suffix, , , member]) => ({
				measure: census.measure,
				dimensions: { [census.dimension]: member ?? suffix },
			}));
	if (!columns) return undefined;
	return {
		kind: "measure-table",
		id: name,
		datasetId,
		geography,
		boundaryYear,
		period,
		measures: columns.map(measureSeriesKey),
		columns,
	};
}
