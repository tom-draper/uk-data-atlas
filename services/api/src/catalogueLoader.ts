import { readApiCatalogues as readRuntimeApiCatalogues } from "@uk-data-atlas/atlas-runtime/api";
import {
	assertMeasureDimensions,
	type CatalogueOptions,
	type MeasureDimensionsConfig,
	type StatisticsVocabulary,
	withDeclaredMeasureIds,
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
