import { STATISTICS_DATASETS } from "@uk-data-atlas/measures";
import { datasetSlug } from "@/lib/datasets";
import { CENSUS_SMALL_AREA_TABLES } from "../../pipeline/src/catalog/censusSmallAreaTables";

/**
 * Every dataset the atlas serves, by its public id, with its primary topic and
 * the other topics it is listed under.
 */
export const DATASETS: readonly {
	id: string;
	topic: string;
	related: readonly string[];
	origin: string;
}[] = [
	...STATISTICS_DATASETS.map((dataset) => ({
		id: datasetSlug(dataset.type),
		topic: dataset.topic,
		related: dataset.related ?? [],
		origin: "statistics",
	})),
	...CENSUS_SMALL_AREA_TABLES.map((table) => ({
		id: `census-2021-${table.table}`,
		topic: table.topic,
		related: table.related ?? [],
		origin: "census tables",
	})),
];
