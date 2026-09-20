import type { BoundaryData, BoundaryGeojson } from "@/lib/types";
import { BOUNDARY_CATALOG, BOUNDARY_TYPES } from "./catalog";
import type { BoundaryType } from "./catalog";
import { filterFeatures } from "./boundaries";
import {
	constituencyReleaseIdForYear,
	type ConstituencyLadOverlaps,
} from "./constituencyLadOverlaps";
import type { BoundaryLocationRelations } from "./filter";

type LocationBoundaryDependencies = {
	relations?: BoundaryLocationRelations;
	constituencyLadOverlaps?: ConstituencyLadOverlaps | null;
	lsoaToLadByYear?: Record<number, Record<string, string>> | null;
};

const LOCATION_BOUNDARY_CACHE_LIMIT = 20;
const filteredBoundaryDataCache = new WeakMap<
	BoundaryData,
	Map<
		string,
		{
			data: BoundaryData;
			constituencyLadOverlaps: ConstituencyLadOverlaps | null;
			lsoaToLadByYear: Record<number, Record<string, string>> | null;
		}
	>
>();

/** Filter one loaded geography group to a named location. */
const filterBoundaryGroup = (
	group: Record<number, BoundaryGeojson | null>,
	type: BoundaryType,
	location: string | null,
	dependencies: LocationBoundaryDependencies = {},
): Record<number, BoundaryGeojson | null> => {
	const filtered: Record<number, BoundaryGeojson | null> = {};
	for (const [year, data] of Object.entries(group)) {
		const releaseId =
			type === "constituency"
				? constituencyReleaseIdForYear(Number(year))
				: undefined;
		filtered[Number(year)] = data
			? filterFeatures(data, {
					location,
					type,
					relations: {
						...dependencies.relations,
						constituencyLadOverlaps: releaseId
							? dependencies.constituencyLadOverlaps?.releases[
									releaseId
								]
							: undefined,
						lsoaToLad: dependencies.lsoaToLadByYear?.[Number(year)],
					},
				})
			: null;
	}
	return filtered;
};

/**
 * Filter loaded boundary properties with a bounded per-location cache.
 *
 * This is deliberately framework-independent: React only decides when the
 * location changes; this module decides how a boundary payload is sliced.
 */
export const getCachedFilteredBoundaryData = (
	rawData: BoundaryData,
	location: string | null,
	dependencies: LocationBoundaryDependencies = {},
): BoundaryData => {
	let cache = filteredBoundaryDataCache.get(rawData);
	if (!cache) {
		cache = new Map();
		filteredBoundaryDataCache.set(rawData, cache);
	}
	const cacheKey = location ?? "";
	const cached = cache.get(cacheKey);
	const constituencyLadOverlaps =
		dependencies.constituencyLadOverlaps ?? null;
	const lsoaToLadByYear = dependencies.lsoaToLadByYear ?? null;
	if (
		cached &&
		cached.constituencyLadOverlaps === constituencyLadOverlaps &&
		cached.lsoaToLadByYear === lsoaToLadByYear
	) {
		cache.delete(cacheKey);
		cache.set(cacheKey, cached);
		return cached.data;
	}

	const data = Object.fromEntries(
		BOUNDARY_TYPES.map((type) => [
			type,
			filterBoundaryGroup(rawData[type], type, location, dependencies),
		]),
	) as BoundaryData;

	if (cache.size >= LOCATION_BOUNDARY_CACHE_LIMIT) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey !== undefined) cache.delete(oldestKey);
	}
	cache.set(cacheKey, {
		data,
		constituencyLadOverlaps,
		lsoaToLadByYear,
	});
	return data;
};
