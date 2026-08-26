// hooks/useBoundaryData.ts
import { startTransition, useEffect, useMemo, useState } from "react";
import { BoundaryData, BoundaryGeojson } from "@lib/types";
import {
	BoundaryType,
	fetchBoundaryFile,
	filterFeatures,
	GEOJSON_PATHS,
	PROPERTY_KEYS,
} from "../data/boundaries/boundaries";
import {
	extractWardLadMappings,
	buildCrossYearMappings,
	buildConstituencyWardMappings,
} from "./useCodeMapper";
import type { CodeMapping, CodeType, YearCode } from "./useCodeMapper";
import type { PrecompiledBoundaryMappings } from "../data/boundaries/mappings";
import { withCDN } from "../helpers/cdn";

const EMPTY_BOUNDARY_DATA: BoundaryData = {
	ward: { 2024: null, 2023: null, 2022: null, 2021: null },
	constituency: { 2024: null, 2019: null, 2017: null, 2015: null },
	localAuthority: {
		2025: null,
		2024: null,
		2023: null,
		2016: null,
	},
	lsoa: { 2011: null },
	dataZone: { 2011: null },
	superOutputArea: { 2011: null },
};

// Filtered feature arrays retain references to the loaded geometry, but can still
// add up when every visited location is kept indefinitely. Keep the most recent
// locations only, and scope each cache to its raw boundary payload so a reload
// cannot return stale data.
const LOCATION_BOUNDARY_CACHE_LIMIT = 20;
const filteredBoundaryDataCache = new WeakMap<
	BoundaryData,
	Map<string, BoundaryData>
>();

const BOUNDARY_MAPPINGS_URL = withCDN(
	"/data/precompiled/boundary-mappings.json",
);
let boundaryMappingsCache: PrecompiledBoundaryMappings | null = null;
let boundaryMappingsPending: Promise<PrecompiledBoundaryMappings> | null = null;

const fetchPrecompiledBoundaryMappings = (): Promise<PrecompiledBoundaryMappings> => {
	if (boundaryMappingsCache) return Promise.resolve(boundaryMappingsCache);
	if (boundaryMappingsPending) return boundaryMappingsPending;

	boundaryMappingsPending = fetch(BOUNDARY_MAPPINGS_URL)
		.then((response) => {
			if (!response.ok) {
				throw new Error(
					`Failed to fetch boundary mappings: ${response.status} ${response.statusText}`,
				);
			}
			return response.json() as Promise<PrecompiledBoundaryMappings>;
		})
		.then((mappings) => {
			boundaryMappingsCache = mappings;
			boundaryMappingsPending = null;
			return mappings;
		})
		.catch((error) => {
			boundaryMappingsPending = null;
			throw error;
		});

	return boundaryMappingsPending;
};

type BoundaryGroupLoad = {
	data: Record<number, BoundaryGeojson>;
};

/** Fetch all boundary files for a given type. */
const fetchBoundaryGroup = async (
	type: BoundaryType,
): Promise<BoundaryGroupLoad> => {
	const paths = GEOJSON_PATHS[type];
	const years = Object.keys(paths).map(Number);

	const settled = await Promise.allSettled(
		years.map(async (year) => {
			const path = paths[year as keyof typeof paths];
			const data = await fetchBoundaryFile(path);
			return [year, data] as const;
		}),
	);

	const results = settled
		.filter((r): r is PromiseFulfilledResult<readonly [number, BoundaryGeojson]> => r.status === "fulfilled")
		.map((r) => r.value);
	settled.forEach((result, index) => {
		if (result.status === "rejected") {
			console.error(
				`[boundaries] Failed to load ${type} year ${years[index]}:`,
				result.reason,
			);
		}
	});

	return {
		data: Object.fromEntries(results),
	};
};

/**
 * Apply location filtering to a group of boundaries
 */
const filterBoundaryGroup = (
	group: Record<number, BoundaryGeojson | null>,
	type: BoundaryType,
	location: string | null,
	getLadForWard?: (wardCode: string) => string | undefined,
): Record<number, BoundaryGeojson | null> => {
	const filtered: Record<number, BoundaryGeojson | null> = {};

	for (const [year, data] of Object.entries(group)) {
		filtered[Number(year)] = data
			? filterFeatures(data, location, type, getLadForWard)
			: null;
	}

	return filtered;
};

export const getCachedFilteredBoundaryData = (
	rawData: BoundaryData,
	location: string | null,
	getLadForWard?: (wardCode: string) => string | undefined,
): BoundaryData => {
	let cache = filteredBoundaryDataCache.get(rawData);
	if (!cache) {
		cache = new Map();
		filteredBoundaryDataCache.set(rawData, cache);
	}

	const cacheKey = location ?? "";
	const cached = cache.get(cacheKey);
	if (cached) {
		// Refresh the entry so the map acts as a least-recently-used cache.
		cache.delete(cacheKey);
		cache.set(cacheKey, cached);
		return cached;
	}

	const filteredData: BoundaryData = {
		ward: filterBoundaryGroup(rawData.ward, "ward", location, getLadForWard),
		constituency: filterBoundaryGroup(rawData.constituency, "constituency", location),
		localAuthority: filterBoundaryGroup(rawData.localAuthority, "localAuthority", location),
		lsoa: filterBoundaryGroup(rawData.lsoa, "lsoa", location),
		dataZone: filterBoundaryGroup(rawData.dataZone, "dataZone", location),
		superOutputArea: filterBoundaryGroup(rawData.superOutputArea, "superOutputArea", location),
	};

	if (cache.size >= LOCATION_BOUNDARY_CACHE_LIMIT) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey !== undefined) cache.delete(oldestKey);
	}
	cache.set(cacheKey, filteredData);

	return filteredData;
};

const extractCodeSets = (
	boundaryData: BoundaryData,
	isLoading: boolean,
): {
	ward: Record<number, Set<string>>;
	constituency: Record<number, Set<string>>;
	localAuthority: Record<number, Set<string>>;
	lsoa: Record<number, Set<string>>;
	dataZone: Record<number, Set<string>>;
	superOutputArea: Record<number, Set<string>>;
} | null => {
	if (isLoading) return null;

	const extractFromGroup = (
		group: Record<number, BoundaryGeojson | null>,
		codeKeys: readonly string[],
	) =>
		Object.entries(group).reduce(
			(acc, [year, data]) => {
				if (data?.features) {
					const codeProp = codeKeys.find(
						(key) =>
							(data.features[0]?.properties as any)?.[key] !==
							undefined,
					);
					if (codeProp) {
						acc[Number(year)] = new Set(
							data.features.flatMap((f) => {
								const v = (f.properties as any)[codeProp];
								return v ? [v] : [];
							}),
						);
					}
				}
				return acc;
			},
			{} as Record<number, Set<string>>,
		);

	return {
		ward: extractFromGroup(boundaryData.ward, PROPERTY_KEYS.wardCode),
		constituency: extractFromGroup(
			boundaryData.constituency,
			PROPERTY_KEYS.constituencyCode,
		),
		localAuthority: extractFromGroup(
			boundaryData.localAuthority,
			PROPERTY_KEYS.ladCode,
		),
		lsoa: extractFromGroup(boundaryData.lsoa, PROPERTY_KEYS.lsoaCode),
		dataZone: extractFromGroup(
			boundaryData.dataZone,
			PROPERTY_KEYS.dataZoneCode,
		),
		superOutputArea: extractFromGroup(
			boundaryData.superOutputArea,
			PROPERTY_KEYS.soaCode,
		),
	};
};

/**
 * Hook to load and filter boundary data
 * Now accepts the full codeMapper from useCodeMapper()
 */
export function useBoundaryData(
	selectedLocation?: string,
	codeMapper?: {
		getLadForWard: (wardCode: string) => string | undefined;
		addWardLadMappings: (mappings: Record<string, string>) => void;
		addLadWardMappings: (
			year: YearCode,
			mappings: Record<string, string[]>,
		) => void;
		addCodeMappings: (type: CodeType, mappings: CodeMapping) => void;
		addConstituencyWardMappings: (
			year: YearCode,
			mappings: Record<string, string[]>,
		) => void;
	},
) {
	const [rawData, setRawData] = useState<BoundaryData>(EMPTY_BOUNDARY_DATA);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	// Extract the individual functions to use as dependencies
	const addWardLadMappings = codeMapper?.addWardLadMappings;
	const addLadWardMappings = codeMapper?.addLadWardMappings;
	const addCodeMappings = codeMapper?.addCodeMappings;
	const getLadForWard = codeMapper?.getLadForWard;
	const addConstituencyWardMappings = codeMapper?.addConstituencyWardMappings;

	// Load all boundary files on mount
	useEffect(() => {
		let mounted = true;

		const loadBoundaries = () => {
			setIsLoading(true);
			setError(null);

			const precompiledMappings = fetchPrecompiledBoundaryMappings().catch(
				(error) => {
					console.warn(
						"[boundaries] Falling back to in-browser mapping generation:",
						error,
					);
					return null;
				},
			);

			Promise.all([
				precompiledMappings,
				fetchBoundaryGroup("ward"),
				fetchBoundaryGroup("constituency"),
				fetchBoundaryGroup("localAuthority"),
				fetchBoundaryGroup("lsoa"),
				fetchBoundaryGroup("dataZone"),
				fetchBoundaryGroup("superOutputArea"),
			])
				.then(([mappings, wards, constituencies, localAuthorities, lsoas, dataZones, superOutputAreas]) => {
					if (!mounted) return;

					startTransition(() => {
						setRawData({
							ward: wards.data,
							constituency: constituencies.data,
							localAuthority: localAuthorities.data,
							lsoa: lsoas.data,
							dataZone: dataZones.data,
							superOutputArea: superOutputAreas.data,
						});
					});

					if (mappings) {
						addWardLadMappings?.(mappings.wardToLad);
						for (const [year, ladMappings] of Object.entries(
							mappings.ladToWards,
						)) {
							addLadWardMappings?.(Number(year), ladMappings);
						}
						addCodeMappings?.("ward", mappings.codeMappings.ward);
						addCodeMappings?.(
							"constituency",
							mappings.codeMappings.constituency,
						);
						addCodeMappings?.(
							"localAuthority",
							mappings.codeMappings.localAuthority,
						);
						for (const [year, constituencyMappings] of Object.entries(
							mappings.constituencyToWards,
						)) {
							addConstituencyWardMappings?.(
								Number(year),
								constituencyMappings,
							);
						}
					} else {
						// Preserve the existing behaviour if an older CDN revision does not
						// yet contain the generated lookup file.
						const wardToLad: Record<string, string> = {};
						for (const [year, boundary] of Object.entries(wards.data)) {
							const wardMappings = extractWardLadMappings(
								boundary.features,
								PROPERTY_KEYS.wardCode,
								PROPERTY_KEYS.ladCode,
							);
							Object.assign(wardToLad, wardMappings.wardToLad);
							addLadWardMappings?.(Number(year), wardMappings.ladToWards);
						}
						addWardLadMappings?.(wardToLad);
						addCodeMappings?.(
							"ward",
							buildCrossYearMappings(
								wards.data,
								"ward",
								Object.keys(wards.data).map(Number),
							),
						);
						addCodeMappings?.(
							"constituency",
							buildCrossYearMappings(
								constituencies.data,
								"constituency",
								Object.keys(constituencies.data).map(Number),
							),
						);
						addCodeMappings?.(
							"localAuthority",
							buildCrossYearMappings(
								localAuthorities.data,
								"localAuthority",
								Object.keys(localAuthorities.data).map(Number),
							),
						);

						const constituencyEntries = Object.entries(constituencies.data)
							.filter(([, conData]) => conData?.features);
						// Only build for the latest ward year — ward highlighting always
						// uses current boundaries, so historical ward years are not needed.
						const latestWardYear = Math.max(
							...Object.keys(wards.data).map(Number).filter(y => wards.data[y]?.features),
						);
						const latestWardData = wards.data[latestWardYear];
						if (latestWardData?.features) {
							const mergedMappings: Record<string, string[]> = {};
							for (const [, conData] of constituencyEntries) {
								const mappings = buildConstituencyWardMappings(latestWardData, conData!);
								Object.assign(mergedMappings, mappings);
							}
							if (Object.keys(mergedMappings).length > 0) {
								addConstituencyWardMappings?.(
									latestWardYear,
									mergedMappings,
								);
							}
						}
					}
				})
				.catch((err) => {
					if (mounted) {
						setError(
							err instanceof Error
								? err
								: new Error("Failed to load boundaries"),
						);
					}
				})
				.finally(() => {
					if (mounted) setIsLoading(false);
				});
		};

		loadBoundaries();

		return () => {
			mounted = false;
		};
	}, [
		addWardLadMappings,
		addLadWardMappings,
		addCodeMappings,
		addConstituencyWardMappings,
	]);

	const loc = selectedLocation || null;

	const filteredData = useMemo<BoundaryData>(() => {
		if (isLoading || !rawData.ward[2024]) return EMPTY_BOUNDARY_DATA;
		return getCachedFilteredBoundaryData(rawData, loc, getLadForWard);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rawData, loc]);

	const boundaryCodes = useMemo(
		() => extractCodeSets(rawData, isLoading),
		[rawData, isLoading],
	);

	return {
		boundaryData: filteredData,
		boundaryCodes,
		isLoading,
		error,
	};
}
