import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	repositoryRootOf,
	statisticsVocabularyPath,
} from "../storage/dataLayout";
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

/** Read the reviewed mapping without loading generated data. */
export const readMeasureDimensionsMapping = (apiRoot: string) =>
	readJson<MeasureDimensionsConfig>(
		join(apiRoot, "config", "measure-dimensions.json"),
	);

/** Read the mapping and generated vocabulary, given the API root. */
export const readMeasureDimensionsConfig = (
	apiRoot: string,
): MeasureDimensions => ({
	config: readMeasureDimensionsMapping(apiRoot),
	vocabulary: readJson(statisticsVocabularyPath(repositoryRootOf(apiRoot))),
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
