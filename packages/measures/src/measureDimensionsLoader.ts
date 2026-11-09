import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATASET_DECLARATIONS } from "@uk-data-atlas/datasets";
import { medianPaySeries } from "./statisticsDatasets/economy.ts";
import {
	airQualitySeries,
	energyConsumptionSeries,
} from "./statisticsDatasets/environment.ts";
import { lifeExpectancySeries } from "./statisticsDatasets/people.ts";
import {
	crimeSeries,
	homelessnessSeries,
	roadCollisionSeries,
} from "./statisticsDatasets/services.ts";
import {
	configDirectory,
	statisticsVocabularyPath,
} from "@uk-data-atlas/atlas-db";
import {
	assertMeasureDimensions,
	type DataCatalog,
	type MeasureDimensionsConfig,
	type MeasureIdMapping,
	type StatisticsVocabulary,
} from "./index.ts";

/** The reviewed mapping and the vocabulary it is checked against. */
export type MeasureDimensions = {
	config: MeasureDimensionsConfig;
	vocabulary: StatisticsVocabulary;
};

const readJson = <T>(path: string): T =>
	JSON.parse(readFileSync(path, "utf8")) as T;

/**
 * The measure ids the dataset declarations publish, each with the statistics
 * measure and members it stands for.
 */
export const declaredMeasureIds = (): Record<string, MeasureIdMapping> =>
	Object.fromEntries([
		...DATASET_DECLARATIONS.flatMap((declaration) =>
			(declaration.catalogue?.indicators ?? []).map((indicator) => [
				indicator.id,
				{
					measure: indicator.measure,
					...(indicator.members
						? { dimensions: { ...indicator.members } }
						: {}),
				},
			]),
		),
		...energyConsumptionSeries().map(
			({ id, ...identity }) => [id, identity] as const,
		),
		...airQualitySeries().map(
			({ id, ...identity }) => [id, identity] as const,
		),
		...lifeExpectancySeries().map(
			({ id, ...identity }) => [id, identity] as const,
		),
		...medianPaySeries().map(
			({ id, ...identity }) => [id, identity] as const,
		),
		...crimeSeries().map(({ id, ...identity }) => [id, identity] as const),
		...homelessnessSeries().map(
			({ id, ...identity }) => [id, identity] as const,
		),
		...roadCollisionSeries().map(
			({ id, ...identity }) => [id, identity] as const,
		),
	]);

/**
 * The reviewed mapping with the measure ids the dataset declarations publish.
 * The file holds the ids no declaration publishes, so one that names a
 * declared id is refused.
 */
export const withDeclaredMeasureIds = (
	config: MeasureDimensionsConfig,
): MeasureDimensionsConfig => {
	const declared = declaredMeasureIds();
	const both = Object.keys(declared).filter((id) => id in config.ids);
	if (both.length > 0)
		throw new Error(
			`measure-dimensions.json maps ${both.join(", ")}, which a dataset declaration publishes`,
		);
	return { ...config, ids: { ...config.ids, ...declared } };
};

/** Read the reviewed mapping without loading generated data. */
export const readMeasureDimensionsMapping = (
	repositoryRoot: string,
): MeasureDimensionsConfig =>
	withDeclaredMeasureIds(
		readJson<MeasureDimensionsConfig>(
			join(configDirectory(repositoryRoot), "measure-dimensions.json"),
		),
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
