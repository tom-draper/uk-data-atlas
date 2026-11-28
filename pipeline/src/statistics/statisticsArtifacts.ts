import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import {
	observationArtifactName,
	measureSeriesSourceKey,
	measureSeriesKey,
	type DataCatalog,
	type MeasureSource,
} from "@uk-data-atlas/measures";
import { statisticsReadPathPath } from "@uk-data-atlas/atlas-db";
import {
	rebuildStatisticsObservationText,
	type StatisticsReadPath,
} from "@uk-data-atlas/measures";
import { readJsonSync } from "../lib/json.ts";

export const statisticsArtifactReader = (
	database: DatabaseSync,
	catalog: DataCatalog,
	readPath: StatisticsReadPath,
) => {
	if (readPath.dataCatalogHash !== catalog.contentHash)
		throw new Error(
			"Statistics selectors do not match the data catalogue.",
		);
	const names = new Set<string>();
	const seriesKeys = new Set<string>();
	const byId = new Map(
		catalog.measures.map((measure) => [measure.id, measure]),
	);
	const selectorFor = (measureId: string, source: MeasureSource) => {
		const identity = byId.get(measureId)?.series;
		if (!identity)
			throw new Error(`Missing series identity for ${measureId}.`);
		const key = measureSeriesSourceKey(identity, source);
		seriesKeys.add(key);
		const selector = readPath.series?.[key];
		if (!selector)
			throw new Error(`Missing statistics selector for ${key}.`);
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
	if (readPath.series)
		for (const key of Object.keys(readPath.series))
			if (!seriesKeys.has(key))
				throw new Error(
					`Unexpected statistics series selector: ${key}.`,
				);
	for (const name of Object.keys(readPath.observations))
		throw new Error(`Artifact ${name} has no statistics read path.`);
	// A measure table's text depends on its selector alone, and every
	// measure of the table names the same one: 220 measures share 21 tables,
	// about 17 MB of text, which would otherwise be rebuilt for each.
	const tables = new Map<string, string>();
	return (measureId: string, source: MeasureSource) => {
		const selector = selectorFor(measureId, source);
		const identity = byId.get(measureId)!.series!;
		const rebuild = () =>
			rebuildStatisticsObservationText(database, selector, {
				measureId: measureSeriesKey(identity),
				sourceGeography: source.sourceGeography,
				periods: source.periods,
			});
		if (!("kind" in selector)) return rebuild();
		const key = JSON.stringify(selector);
		let text = tables.get(key);
		if (text === undefined) tables.set(key, (text = rebuild()));
		return text;
	};
};

export const openStatisticsArtifactReader = (
	repositoryRoot: string,
	catalog: DataCatalog,
) => {
	const readPath = readJsonSync(
		statisticsReadPathPath(repositoryRoot),
	) as StatisticsReadPath;
	const database = new DatabaseSync(
		join(repositoryRoot, "data/build/atlas-base.sqlite"),
		{ readOnly: true },
	);
	try {
		// These build readers repeatedly visit observations in series order.
		database.exec("PRAGMA mmap_size = 2147483648");
		return {
			database,
			readArtifact: statisticsArtifactReader(database, catalog, readPath),
		};
	} catch (error) {
		database.close();
		throw error;
	}
};
