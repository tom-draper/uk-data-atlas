import type { PopulationCodeResolver } from "../data/boundaries/codeMapper";
import type { SelectedArea } from "../types/areas";
import type {
	PopulationDataset,
	PopulationWardData,
} from "../types/population";

const MAX_LAD_CACHE_ENTRIES = 50;
const datasetCacheIds = new WeakMap<object, number>();
let nextDatasetCacheId = 0;

const datasetCacheId = (dataset: object) => {
	let id = datasetCacheIds.get(dataset);
	if (id === undefined) {
		id = nextDatasetCacheId++;
		datasetCacheIds.set(dataset, id);
	}
	return id;
};

export function resolveWardData(
	dataset: PopulationDataset,
	wardCode: string,
	codeMapper: Pick<PopulationCodeResolver, "getCodeForYear"> | undefined,
): PopulationWardData | undefined {
	let wardData = dataset.data[wardCode];
	if (!wardData && codeMapper?.getCodeForYear) {
		const mappedCode = codeMapper.getCodeForYear(
			"ward",
			wardCode,
			dataset.boundaryYear,
		);
		if (mappedCode) wardData = dataset.data[mappedCode];
	}
	return wardData;
}

export type PopulationWardRecord = {
	/** Boundary code used to find geometry, before any dataset-year mapping. */
	code: string;
	data: PopulationWardData;
};

/** Whether a selected area can be resolved without caching a premature miss. */
export function populationAreaMappingsAvailable(
	selectedArea: SelectedArea | null,
	codeMapper: PopulationCodeResolver | undefined,
): boolean {
	switch (selectedArea?.type) {
		case "ward":
			return true;
		case "localAuthority":
			return !!codeMapper?.getWardsForLad;
		case "constituency":
			return !!codeMapper?.getWardsForConstituency;
		default:
			return false;
	}
}

/**
 * Resolves the ward records represented by a selected area. The charts can
 * then aggregate their own metric without each repeating ward/LAD/
 * constituency mapping rules.
 *
 * `null` means that the selected area is unsupported or the required mapping
 * has not arrived; an empty array is a supported area with no matching data.
 */
export function resolvePopulationAreaWards(
	dataset: PopulationDataset,
	selectedArea: SelectedArea | null,
	codeMapper: PopulationCodeResolver | undefined,
): PopulationWardRecord[] | null {
	if (
		!selectedArea ||
		!populationAreaMappingsAvailable(selectedArea, codeMapper)
	)
		return null;

	const wardCodes = (() => {
		switch (selectedArea.type) {
			case "ward":
				return [selectedArea.code];
			case "localAuthority":
				return codeMapper?.getWardsForLad(
					selectedArea.code,
					dataset.boundaryYear,
				);
			case "constituency":
				return codeMapper?.getWardsForConstituency(
					selectedArea.code,
					dataset.boundaryYear,
				);
			default:
				return null;
		}
	})();
	if (!wardCodes) return null;

	return wardCodes.flatMap((code) => {
		const data = resolveWardData(dataset, code, codeMapper);
		return data ? [{ code, data }] : [];
	});
}

// Bounded LRU-style cache lookup. Dataset identity and mapping generation are
// part of the key because location slices and constituency mappings can change
// while a chart component remains mounted.
export function getAreaCachedValue<T>(
	cache: Map<string, Map<number, T>>,
	areaKey: string,
	year: number,
	dataset: object,
	mappingGeneration: number,
	compute: () => T,
): T {
	const cacheKey = `${areaKey}:${datasetCacheId(dataset)}:${mappingGeneration}`;
	if (!cache.has(cacheKey)) {
		if (cache.size >= MAX_LAD_CACHE_ENTRIES) {
			cache.delete(cache.keys().next().value!);
		}
		cache.set(cacheKey, new Map());
	}
	const yearCache = cache.get(cacheKey)!;
	if (!yearCache.has(year)) {
		yearCache.set(year, compute());
	}
	return yearCache.get(year)!;
}

export function getLadCachedValue<T>(
	cache: Map<string, Map<number, T>>,
	ladCode: string,
	year: number,
	dataset: object,
	mappingGeneration: number,
	compute: () => T,
): T {
	return getAreaCachedValue(
		cache,
		`lad-${ladCode}`,
		year,
		dataset,
		mappingGeneration,
		compute,
	);
}
