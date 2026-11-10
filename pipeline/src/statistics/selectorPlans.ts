import type {
	StatisticsSelector,
	StatisticsTableSelector,
} from "@uk-data-atlas/measures";
import { CENSUS_SMALL_AREA_TABLES } from "../catalog/censusSmallArea.ts";

const PARTITION_BY_CODE_YEAR = new Set([
	"car-availability",
	"claimant-count",
	"ethnicity",
	"qualification",
	"travel-to-work",
	"unemployment",
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
	ids: Record<
		string,
		{ measure: string; dimensions?: Record<string, string> }
	>,
): StatisticsTableSelector | undefined {
	const census = CENSUS_SMALL_AREA_TABLES.find(
		(table) => datasetId === `census-2021-${table.table}`,
	);
	if (!census) return undefined;
	const measures = census.categories.map(
		([suffix]) => `${census.measurePrefix}-${suffix}`,
	);
	return {
		kind: "measure-table",
		id: name,
		datasetId,
		geography,
		boundaryYear,
		period,
		measures,
		columns: measures.map((id) => {
			const mapping = ids[id];
			if (!mapping)
				throw new Error(`Missing statistics mapping for ${id}`);
			return {
				measure: mapping.measure,
				dimensions: mapping.dimensions ?? {},
			};
		}),
	};
}
