import { readApiCatalogues as readRuntimeApiCatalogues } from "@uk-data-atlas/atlas-runtime/api";
import {
	assertMeasureDimensions,
	type CatalogueOptions,
	type MeasureDimensionsConfig,
	type StatisticsVocabulary,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	statisticsReadPathPath,
	statisticsVocabularyPath,
	type StatisticsReadPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { readFileSync } from "node:fs";
import measureDimensionsConfig from "../config/measure-dimensions.json" with { type: "json" };

export * from "@uk-data-atlas/atlas-runtime/catalogue";

/**
 * The reviewed measure dimension mapping is bundled with the server.
 */
export const measureDimensions = {
	config: measureDimensionsConfig as MeasureDimensionsConfig,
};

/**
 * The catalogues the API serves: the runtime's, read with the API's
 * statistics read path, and the measure dimension mapping, refused unless it
 * maps every catalogue measure id.
 */
export const readApiCatalogues = (
	apiRoot: string,
	options: CatalogueOptions = {},
) => {
	const catalogues = readRuntimeApiCatalogues(apiRoot, {
		statisticsReadPath: JSON.parse(
			readFileSync(statisticsReadPathPath(apiRoot), "utf8"),
		) as StatisticsReadPath,
		...options,
	});
	const dimensions = {
		...measureDimensions,
		vocabulary: JSON.parse(
			readFileSync(statisticsVocabularyPath(apiRoot), "utf8"),
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
