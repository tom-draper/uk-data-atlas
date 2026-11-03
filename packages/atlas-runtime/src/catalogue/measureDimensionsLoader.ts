import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	configDirectory,
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
export const readMeasureDimensionsMapping = (repositoryRoot: string) =>
	readJson<MeasureDimensionsConfig>(
		join(configDirectory(repositoryRoot), "measure-dimensions.json"),
	);

/** Read the mapping and generated vocabulary, given the repository root. */
export const readMeasureDimensionsConfig = (
	repositoryRoot: string,
): MeasureDimensions => ({
	config: readMeasureDimensionsMapping(repositoryRoot),
	vocabulary: readJson(statisticsVocabularyPath(repositoryRoot)),
});

/** Read the mapping and refuse it unless it maps every catalogue measure id. */
export const readMeasureDimensions = (
	repositoryRoot: string,
	catalog: DataCatalog,
): MeasureDimensions => {
	const dimensions = readMeasureDimensionsConfig(repositoryRoot);
	assertMeasureDimensions(catalog, dimensions.config, dimensions.vocabulary);
	return dimensions;
};
