// hooks/useBoundaryData.ts
import {
	startTransition,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import { BoundaryData, BoundaryGeojson, getFeatureProp } from "@lib/types";
import {
	BoundaryType,
	fetchBoundaryFile,
	filterFeatures,
} from "../data/boundaries/boundaries";
import {
	BOUNDARY_CATALOG,
	BOUNDARY_TYPES,
	boundaryYears,
} from "../data/boundaries/catalog";
import {
	extractWardLadMappings,
	buildCrossYearMappings,
	buildConstituencyWardMappings,
} from "../data/boundaries/mappings";
import type {
	CodeMapping,
	CodeType,
	PrecompiledBoundaryMappings,
	YearCode,
} from "../data/boundaries/mappings";
import { withCDN } from "../helpers/cdn";
import { requiredBoundaryTypes } from "../data/boundaries/required";
import {
	DEFAULT_VISIBILITY,
	getVisibilitySnapshot,
	subscribeVisibility,
} from "../context/ChartVisibilityContext";

const EMPTY_BOUNDARY_DATA: BoundaryData = Object.fromEntries(
	BOUNDARY_TYPES.map((type) => [
		type,
		Object.fromEntries(boundaryYears(type).map((year) => [year, null])),
	]),
) as BoundaryData;

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

const fetchPrecompiledBoundaryMappings =
	(): Promise<PrecompiledBoundaryMappings> => {
		if (boundaryMappingsCache)
			return Promise.resolve(boundaryMappingsCache);
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
	const paths = BOUNDARY_CATALOG[type].vintages;
	const years = Object.keys(paths).map(Number);

	const settled = await Promise.allSettled(
		years.map(async (year) => {
			const path = paths[year as keyof typeof paths];
			const data = await fetchBoundaryFile(path);
			return [year, data] as const;
		}),
	);

	const results = settled
		.filter(
			(
				r,
			): r is PromiseFulfilledResult<
				readonly [number, BoundaryGeojson]
			> => r.status === "fulfilled",
		)
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

	const filteredData = Object.fromEntries(
		BOUNDARY_TYPES.map((type) => [
			type,
			filterBoundaryGroup(rawData[type], type, location, getLadForWard),
		]),
	) as BoundaryData;

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
): Record<BoundaryType, Record<number, Set<string>>> | null => {
	if (isLoading) return null;

	const extractFromGroup = (
		group: Record<number, BoundaryGeojson | null>,
		codeKeys: readonly string[],
	) =>
		Object.entries(group).reduce(
			(acc, [year, data]) => {
				const first = data?.features[0];
				if (first) {
					const codeProp = codeKeys.find(
						(key) =>
							getFeatureProp(first.properties, key) !== undefined,
					);
					if (codeProp) {
						acc[Number(year)] = new Set(
							data.features.flatMap((feature) => {
								const code = getFeatureProp(
									feature.properties,
									codeProp,
								);
								return code ? [code] : [];
							}),
						);
					}
				}
				return acc;
			},
			{} as Record<number, Set<string>>,
		);

	return Object.fromEntries(
		BOUNDARY_TYPES.map((type) => [
			type,
			extractFromGroup(
				boundaryData[type],
				BOUNDARY_CATALOG[type].properties.code,
			),
		]),
	) as Record<BoundaryType, Record<number, Set<string>>>;
};

/**
 * Hook to load and filter boundary data
 * Now accepts the full codeMapper from useCodeMapper()
 */
export function useBoundaryData(
	activeBoundaryType?: BoundaryType,
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

	// Only the geographies the visible charts can actually aggregate against,
	// rather than every boundary the catalogue serves. Subscribed rather than
	// read once, so enabling a chart loads what it needs.
	const visibility = useSyncExternalStore(
		subscribeVisibility,
		getVisibilitySnapshot,
		() => DEFAULT_VISIBILITY,
	);
	const requiredKey = useMemo(
		() =>
			[...requiredBoundaryTypes(visibility, [activeBoundaryType])]
				.sort()
				.join(","),
		[visibility, activeBoundaryType],
	);
	const loadedTypes = useRef(new Set<BoundaryType>());

	useEffect(() => {
		let mounted = true;

		const loadBoundaries = () => {
			setIsLoading(true);
			setError(null);

			const precompiledMappings =
				fetchPrecompiledBoundaryMappings().catch((error) => {
					console.warn(
						"[boundaries] Falling back to in-browser mapping generation:",
						error,
					);
					return null;
				});

			// Fetch only what is newly required; anything already held stays.
			const wanted = requiredKey
				? (requiredKey.split(",") as BoundaryType[])
				: [];
			const missing = wanted.filter(
				(type) => !loadedTypes.current.has(type),
			);

			Promise.all([
				precompiledMappings,
				Promise.all(
					missing.map(
						async (type) =>
							[
								type,
								(await fetchBoundaryGroup(type)).data,
							] as const,
					),
				),
			])
				.then(([mappings, groups]) => {
					if (!mounted) return;

					for (const [type] of groups) loadedTypes.current.add(type);
					const fetched = Object.fromEntries(groups) as Partial<
						Record<BoundaryType, Record<number, BoundaryGeojson>>
					>;

					startTransition(() => {
						setRawData((previous) => ({
							...previous,
							...fetched,
						}));
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
						for (const [
							year,
							constituencyMappings,
						] of Object.entries(mappings.constituencyToWards)) {
							addConstituencyWardMappings?.(
								Number(year),
								constituencyMappings,
							);
						}
					} else if (
						fetched.ward &&
						fetched.constituency &&
						fetched.localAuthority
					) {
						// Preserve the existing behaviour if an older CDN revision does not
						// yet contain the generated lookup file. Only possible when this
						// batch happened to fetch all three geographies it derives from.
						const wardToLad: Record<string, string> = {};
						for (const [year, boundary] of Object.entries(
							fetched.ward,
						)) {
							const wardMappings = extractWardLadMappings(
								boundary.features,
								BOUNDARY_CATALOG.ward.properties.code,
								BOUNDARY_CATALOG.localAuthority.properties.code,
							);
							Object.assign(wardToLad, wardMappings.wardToLad);
							addLadWardMappings?.(
								Number(year),
								wardMappings.ladToWards,
							);
						}
						addWardLadMappings?.(wardToLad);
						addCodeMappings?.(
							"ward",
							buildCrossYearMappings(
								fetched.ward,
								"ward",
								Object.keys(fetched.ward).map(Number),
							),
						);
						addCodeMappings?.(
							"constituency",
							buildCrossYearMappings(
								fetched.constituency,
								"constituency",
								Object.keys(fetched.constituency).map(Number),
							),
						);
						addCodeMappings?.(
							"localAuthority",
							buildCrossYearMappings(
								fetched.localAuthority,
								"localAuthority",
								Object.keys(fetched.localAuthority).map(Number),
							),
						);

						const constituencyEntries = Object.entries(
							fetched.constituency,
						).filter(([, conData]) => conData?.features);
						// Only build for the latest ward year — ward highlighting always
						// uses current boundaries, so historical ward years are not needed.
						const wardGroup = fetched.ward;
						const latestWardYear = Math.max(
							...Object.keys(wardGroup)
								.map(Number)
								.filter((y) => wardGroup[y]?.features),
						);
						const latestWardData = wardGroup[latestWardYear];
						if (latestWardData?.features) {
							const mergedMappings: Record<string, string[]> = {};
							for (const [, conData] of constituencyEntries) {
								const mappings = buildConstituencyWardMappings(
									latestWardData,
									conData!,
								);
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
		requiredKey,
		addWardLadMappings,
		addLadWardMappings,
		addCodeMappings,
		addConstituencyWardMappings,
	]);

	const loc = selectedLocation || null;

	const filteredData = useMemo<BoundaryData>(() => {
		if (isLoading) return EMPTY_BOUNDARY_DATA;
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
