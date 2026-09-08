import { PopulationDataset, PopulationWardData } from "../types/population";
import { CodeMapper } from "../hooks/useCodeMapper";

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
	codeMapper: CodeMapper | undefined,
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
