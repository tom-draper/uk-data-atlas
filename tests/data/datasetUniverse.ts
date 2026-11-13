import { STATISTICS_DATASETS } from "@uk-data-atlas/measures";
import { datasetSlug } from "@/lib/datasets";
import { CENSUS_SMALL_AREA_TABLES } from "../../pipeline/src/catalog/censusSmallAreaTables";

/** Every dataset the atlas serves, by its public id, with its primary topic. */
export const DATASETS: readonly {
	id: string;
	topic: string;
	origin: string;
}[] = [
	...STATISTICS_DATASETS.map((dataset) => ({
		id: datasetSlug(dataset.type),
		topic: dataset.topic,
		origin: "statistics",
	})),
	...CENSUS_SMALL_AREA_TABLES.map((table) => ({
		id: `census-2021-${table.table}`,
		topic: table.topic,
		origin: "census tables",
	})),
];
