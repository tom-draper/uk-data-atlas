import { readFileSync } from "node:fs";
import {
	atlasDatabasePath,
	statisticsVocabularyPath,
} from "@uk-data-atlas/atlas-db";
import { MEASURE_DIMENSIONS_CONFIG } from "./computedMeasures.ts";
import { readStatisticsVocabulary } from "./atlasStatisticsVocabulary.ts";
import {
	assertMeasureDimensions,
	type DataCatalog,
	type MeasureDimensionsConfig,
	type StatisticsVocabulary,
} from "./index.ts";

/** What the API serves beyond the statistics tables, and the vocabulary. */
export type MeasureDimensions = {
	config: MeasureDimensionsConfig;
	vocabulary: StatisticsVocabulary;
};

/** Read the generated vocabulary, given the repository root. */
export const readMeasureDimensionsConfig = (
	repositoryRoot: string,
): MeasureDimensions => ({
	config: MEASURE_DIMENSIONS_CONFIG,
	vocabulary: JSON.parse(
		readFileSync(statisticsVocabularyPath(repositoryRoot), "utf8"),
	) as StatisticsVocabulary,
});

/** Read the vocabulary and refuse it unless it holds every catalogue series. */
export const readMeasureDimensions = (
	repositoryRoot: string,
	catalog: DataCatalog,
): MeasureDimensions => {
	const dimensions = {
		config: MEASURE_DIMENSIONS_CONFIG,
		vocabulary: readStatisticsVocabulary(atlasDatabasePath(repositoryRoot)),
	};
	assertMeasureDimensions(catalog, dimensions.config, dimensions.vocabulary);
	return dimensions;
};
