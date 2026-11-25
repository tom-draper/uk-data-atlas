import { readApiCatalogues as readRuntimeApiCatalogues } from "./runtime/index.ts";
import { assertMeasureDimensions } from "@uk-data-atlas/catalogue/node";
import {
	readStatisticsVocabulary,
	MEASURE_DIMENSIONS_CONFIG,
} from "@uk-data-atlas/measures";
import { type CatalogueOptions } from "@uk-data-atlas/atlas-loader";
import { atlasDatabasePath } from "@uk-data-atlas/atlas-db";

export * from "@uk-data-atlas/catalogue/node";

/**
 * The runtime catalogues and the API's vocabulary for every catalogue series.
 */
export const readApiCatalogues = (
	repositoryRoot: string,
	options: CatalogueOptions = {},
) => {
	const dimensions = {
		config: MEASURE_DIMENSIONS_CONFIG,
		vocabulary: readStatisticsVocabulary(atlasDatabasePath(repositoryRoot)),
	};
	const catalogues = readRuntimeApiCatalogues(repositoryRoot, options);
	assertMeasureDimensions(
		catalogues.dataCatalog,
		dimensions.config,
		dimensions.vocabulary,
	);
	return {
		...catalogues,
		measureDimensions: dimensions,
	};
};

export type ApiCatalogues = ReturnType<typeof readApiCatalogues>;
