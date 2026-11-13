import { describe, expect, it } from "vitest";
import { STATISTICS_DATASETS } from "@uk-data-atlas/measures";
import {
	DATASET_DECLARATIONS,
	DATASET_SPLIT_MODULES,
	getDatasetTopic,
	isDatasetTopic,
	moduleOfDataset,
	typeOf,
} from "@uk-data-atlas/datasets";
import { CENSUS_SMALL_AREA_TABLES } from "../../pipeline/src/catalog/censusSmallAreaTables";

type Filed = {
	id: string;
	topic: unknown;
	related?: readonly unknown[];
};

/** Every dataset the atlas builds from a definition, by id. */
const FILED: readonly Filed[] = [
	...STATISTICS_DATASETS.map((dataset) => ({ ...dataset, id: dataset.type })),
	...CENSUS_SMALL_AREA_TABLES.map((table) => ({
		...table,
		id: `census-2021-${table.table}`,
	})),
];

describe("dataset topics", () => {
	it("files every dataset under a registered primary topic", () => {
		expect(FILED.length).toBeGreaterThan(50);
		for (const { id, topic } of FILED)
			expect(isDatasetTopic(topic), id).toBe(true);
	});

	it("keeps each declaration's topic in its statistics", () => {
		for (const declaration of DATASET_DECLARATIONS) {
			const statistics = STATISTICS_DATASETS.find(
				({ type }) => type === typeOf(declaration),
			);
			expect(statistics?.topic, declaration.id).toBe(declaration.topic);
			expect(isDatasetTopic(declaration.topic), declaration.id).toBe(
				true,
			);
		}
	});

	it("lists only registered related topics, never the primary or a repeat", () => {
		for (const { id, topic, related = [] } of FILED) {
			for (const other of related) {
				expect(isDatasetTopic(other), id).toBe(true);
				expect(other, id).not.toBe(topic);
			}
			expect(new Set(related).size, id).toBe(related.length);
		}
	});

	it("homes each dataset in its theme's module or a split of that theme", () => {
		for (const { id, topic } of FILED) {
			const theme = getDatasetTopic(topic as never).theme;
			const module = moduleOfDataset({ id, topic: topic as never });
			const split = DATASET_SPLIT_MODULES.find(
				(candidate) => candidate.id === module,
			);
			if (split) expect(split.theme, id).toBe(theme);
			else expect(module, id).toBe(theme);
		}
	});
});
