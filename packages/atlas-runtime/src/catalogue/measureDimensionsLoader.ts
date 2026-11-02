import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	assertMeasureDimensions,
	type DataCatalog,
	type MeasureDimensionsConfig,
	type StatisticsVocabulary,
} from "@uk-data-atlas/measures";

/** The reviewed mapping and the vocabulary it is checked against. */
export type MeasureDimensions = {
	config: MeasureDimensionsConfig;
	vocabulary: StatisticsVocabulary;
};

const readJson = <T>(path: string): T =>
	JSON.parse(readFileSync(path, "utf8")) as T;

/** Read the mapping from the API's config directory, given the API root. */
export const readMeasureDimensionsConfig = (
	apiRoot: string,
): MeasureDimensions => ({
	config: readJson(join(apiRoot, "config", "measure-dimensions.json")),
	vocabulary: readJson(join(apiRoot, "config", "statistics-vocabulary.json")),
});

/** Read the mapping and refuse it unless it maps every catalogue measure id. */
export const readMeasureDimensions = (
	apiRoot: string,
	catalog: DataCatalog,
): MeasureDimensions => {
	const dimensions = readMeasureDimensionsConfig(apiRoot);
	assertMeasureDimensions(catalog, dimensions.config, dimensions.vocabulary);
	return dimensions;
};
