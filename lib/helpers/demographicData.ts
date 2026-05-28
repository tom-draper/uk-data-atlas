import { PopulationDataset, PopulationWardData } from "../types/population";
import { CodeMapper } from "../hooks/useCodeMapper";

const MAX_LAD_CACHE_ENTRIES = 50;

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

// Bounded LRU-style cache lookup — computes and caches on first access per (ladCode, year) pair.
export function getLadCachedValue<T>(
	cache: Map<string, Map<number, T>>,
	ladCode: string,
	year: number,
	compute: () => T,
): T {
	const cacheKey = `lad-${ladCode}`;
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
