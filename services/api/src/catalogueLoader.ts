import { readApiCatalogues as readRuntimeApiCatalogues } from "./runtime/index.ts";
import {
	assertMeasureDimensions,
	type MeasureDimensionsConfig,
	type StatisticsVocabulary,
} from "@uk-data-atlas/catalogue/node";
import {
	withDeclaredMeasureIds,
	type StatisticsReadPath,
} from "@uk-data-atlas/measures";
import { type CatalogueOptions } from "@uk-data-atlas/atlas-loader";
import {
	statisticsReadPathPath,
	statisticsVocabularyPath,
} from "@uk-data-atlas/atlas-db";

import { readFileSync } from "node:fs";
import measureDimensionsConfig from "../config/measure-dimensions.json" with { type: "json" };

export * from "@uk-data-atlas/catalogue/node";

/**
 * The reviewed measure dimension mapping is bundled with the server.
 */
export const measureDimensions = {
	config: withDeclaredMeasureIds(
		measureDimensionsConfig as MeasureDimensionsConfig,
	),
};

/**
 * The catalogues the API serves: the runtime's, read with the API's
 * statistics read path, and the measure dimension mapping, refused unless it
 * maps every catalogue measure id.
 */
export const readApiCatalogues = (
	repositoryRoot: string,
	options: CatalogueOptions = {},
) => {
	const catalogues = readRuntimeApiCatalogues(repositoryRoot, {
		statisticsReadPath: JSON.parse(
			readFileSync(statisticsReadPathPath(repositoryRoot), "utf8"),
		) as StatisticsReadPath,
		...options,
	});
	const dimensions = {
		...measureDimensions,
		vocabulary: JSON.parse(
			readFileSync(statisticsVocabularyPath(repositoryRoot), "utf8"),
		) as StatisticsVocabulary,
	};
	assertMeasureDimensions(
		catalogues.dataCatalog,
		dimensions.config,
		dimensions.vocabulary,
	);
	return { ...catalogues, measureDimensions: dimensions };
};

export type ApiCatalogues = ReturnType<typeof readApiCatalogues>;
