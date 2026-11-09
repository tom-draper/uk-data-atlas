import { readDataCatalog } from "./catalogueManifestLoader.ts";
import { readMeasureDimensions } from "@uk-data-atlas/measures";
import { readMeasureObservations } from "@uk-data-atlas/measures";
import type { MeasureValuesContext } from "@uk-data-atlas/measures";

/**
 * What `queryMeasureValues` reads, loaded from a build for a process that is
 * not the API: the data catalogue, the reviewed dimension mapping and the
 * lazily read observation artifacts. Nothing is parsed until a request asks
 * for that measure, and the observation cache drops what it read when
 * `atlas.sqlite` is replaced.
 *
 * Needs `pnpm data:build` to have written `data-catalog.json`,
 * `statistics-read-path.json` and `statistics-vocabulary.json`, next to
 * `atlas.sqlite`.
 */
export const readMeasureValuesContext = (
	repositoryRoot: string,
	options: { observationCacheBytes?: number } = {},
): MeasureValuesContext => {
	const dataCatalog = readDataCatalog(repositoryRoot);
	return {
		dataCatalog,
		measureDimensions: readMeasureDimensions(repositoryRoot, dataCatalog),
		measureObservations: readMeasureObservations(
			repositoryRoot,
			dataCatalog,
			options.observationCacheBytes,
		),
	};
};
