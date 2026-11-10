import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	observationArtifactName,
	measureSeriesSourceKey,
	type DataCatalog,
	type MeasureSource,
	type MeasureSeriesIdentity,
} from "@uk-data-atlas/measures";
import { statisticsReadPathPath } from "@uk-data-atlas/atlas-db";
import { readMeasureDimensionsMapping } from "@uk-data-atlas/measures";
import {
	rebuildStatisticsObservationText,
	type StatisticsReadPath,
} from "@uk-data-atlas/measures";

export const statisticsArtifactReader = (
	database: DatabaseSync,
	catalog: DataCatalog,
	readPath: StatisticsReadPath,
	identities?: Readonly<Record<string, MeasureSeriesIdentity>>,
) => {
	if (readPath.dataCatalogHash !== catalog.contentHash)
		throw new Error(
			"Statistics selectors do not match the data catalogue.",
		);
	const names = new Set<string>();
	const seriesKeys = new Set<string>();
	const selectorFor = (measureId: string, source: MeasureSource) => {
		const identity = identities?.[measureId];
		if (readPath.series && identities) {
			if (!identity)
				throw new Error(`Missing series identity for ${measureId}.`);
			const key = measureSeriesSourceKey(identity, source);
			seriesKeys.add(key);
			const selector = readPath.series[key];
			if (!selector)
				throw new Error(`Missing statistics selector for ${key}.`);
			return selector;
		}
		const name = observationArtifactName(measureId, source);
		const selector = readPath.statistics?.[name];
		if (!selector)
			throw new Error(`Missing statistics selector for ${name}.`);
		return selector;
	};
	const datasets = new Set(catalog.datasets.map((dataset) => dataset.id));
	for (const measure of catalog.measures) {
		for (const source of measure.sources) {
			const name = observationArtifactName(measure.id, source);
			if (!datasets.has(source.datasetId))
				throw new Error(
					`The data catalogue has no ${source.datasetId} dataset.`,
				);
			selectorFor(measure.id, source);
			names.add(name);
		}
	}
	for (const name of Object.keys(readPath.statistics ?? {}))
		if (!names.has(name))
			throw new Error(`Unexpected statistics selector: ${name}.`);
	if (readPath.series && identities)
		for (const key of Object.keys(readPath.series))
			if (!seriesKeys.has(key))
				throw new Error(
					`Unexpected statistics series selector: ${key}.`,
				);
	for (const name of Object.keys(readPath.observations))
		throw new Error(`Artifact ${name} has no statistics read path.`);
	return (measureId: string, source: MeasureSource) => {
		const selector = selectorFor(measureId, source);
		return rebuildStatisticsObservationText(database, selector, {
			measureId,
			sourceGeography: source.sourceGeography,
			periods: source.periods,
		});
	};
};

export const openStatisticsArtifactReader = (
	repositoryRoot: string,
	catalog: DataCatalog,
) => {
	const readPath = JSON.parse(
		readFileSync(statisticsReadPathPath(repositoryRoot), "utf8"),
	) as StatisticsReadPath;
	const database = new DatabaseSync(
		join(repositoryRoot, "data/build/atlas-base.sqlite"),
		{ readOnly: true },
	);
	try {
		return {
			database,
			readArtifact: statisticsArtifactReader(
				database,
				catalog,
				readPath,
				readPath.series
					? readMeasureDimensionsMapping(repositoryRoot).ids
					: undefined,
			),
		};
	} catch (error) {
		database.close();
		throw error;
	}
};
