import { readApiCatalogues as readRuntimeApiCatalogues } from "@uk-data-atlas/atlas-runtime/api";
import type { CatalogueOptions } from "@uk-data-atlas/atlas-runtime/catalogue";
import type { StatisticsReadPath } from "@uk-data-atlas/atlas-runtime/storage";
import statisticsReadPath from "../config/statistics-read-path.json" with { type: "json" };

export * from "@uk-data-atlas/atlas-runtime/catalogue";

/**
 * The reviewed statistics read path. It is bundled with the server rather
 * than read from disk, since the deployed image ships only the compiled
 * server and the data build.
 */
export const apiStatisticsReadPath = statisticsReadPath as StatisticsReadPath;

/**
 * The catalogues the API serves: the runtime's, read with the API's
 * statistics read path.
 */
export const readApiCatalogues = (
	apiRoot: string,
	options: CatalogueOptions = {},
) => {
	const catalogues = readRuntimeApiCatalogues(apiRoot, {
		statisticsReadPath: apiStatisticsReadPath,
		...options,
	});
	return catalogues;
};

export type ApiCatalogues = ReturnType<typeof readApiCatalogues>;
