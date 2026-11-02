import { readApiCatalogues as readRuntimeApiCatalogues } from "@uk-data-atlas/atlas-runtime/api";
import {
	assertMeasureDimensions,
	type CatalogueOptions,
	type MeasureDimensions,
	type MeasureDimensionsConfig,
	type StatisticsVocabulary,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import type { StatisticsReadPath } from "@uk-data-atlas/atlas-runtime/storage";
import measureDimensionsConfig from "../config/measure-dimensions.json" with { type: "json" };
import statisticsVocabulary from "../config/statistics-vocabulary.json" with { type: "json" };
import statisticsReadPath from "../config/statistics-read-path.json" with { type: "json" };

export * from "@uk-data-atlas/atlas-runtime/catalogue";

/**
 * The reviewed measure dimension mapping and read path. They are bundled
 * with the server rather than read from disk, since the deployed image ships
 * only the compiled server and the data build.
 */
export const measureDimensions: MeasureDimensions = {
	config: measureDimensionsConfig as MeasureDimensionsConfig,
	vocabulary: statisticsVocabulary as StatisticsVocabulary,
};
export const apiStatisticsReadPath = statisticsReadPath as StatisticsReadPath;

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
		statisticsReadPath: apiStatisticsReadPath,
		...options,
	});
	assertMeasureDimensions(
		catalogues.dataCatalog,
		measureDimensions.config,
		measureDimensions.vocabulary,
	);
	return { ...catalogues, measureDimensions };
};

export type ApiCatalogues = ReturnType<typeof readApiCatalogues>;
