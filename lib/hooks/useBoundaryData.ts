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
	fetchBoundaryProperties,
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
	constituencyReleaseIdForYear,
	fetchConstituencyLadOverlaps,
	type ConstituencyLadOverlaps,
} from "../data/boundaries/constituencyLadOverlaps";
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
	Map<
		string,
		{
			data: BoundaryData;
			constituencyLadOverlaps: ConstituencyLadOverlaps | null;
		}
	>
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
	/** One message per vintage that could not be fetched. */
	failures: string[];
};

/**
 * Fetch every vintage of a geography, as properties rather than geometry.
 *
 * This is what the charts aggregate over, and none of them read a coordinate:
 * `filterFeatures` and the reducers key off the code properties, area and
 * extent come from the compiled values, and a hover is a dataset lookup. The
 * geometry of the one vintage being drawn is fetched separately, by whatever
 * is drawing it — which is the difference between holding a few hundred MB and
 * several GB, and between fetching 14 MB of wards and 93 MB.
 */
const fetchBoundaryGroup = async (
	type: BoundaryType,
): Promise<BoundaryGroupLoad> => {
	const paths = BOUNDARY_CATALOG[type].propertyVintages;
	const years = Object.keys(paths).map(Number);

	const settled = await Promise.allSettled(
		years.map(async (year) => {
			const path = paths[year as keyof typeof paths];
			const data = await fetchBoundaryProperties(path);
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
	// A vintage that fails to load leaves every chart keyed to it drawing
	// nothing, and the card gives no sign of it: it still renders, aggregates
	// to zero and, when clicked, leaves the previous layer on the map. Report
	// the failure rather than only logging it. One file often serves several
	// years, so a single 404 can take out one card and leave its neighbours
	// working, which is a confusing thing to debug from the outside.
	const failures: string[] = [];
	settled.forEach((result, index) => {
		if (result.status === "rejected") {
			const message = `Could not load ${type} boundaries for ${years[index]}: ${
				result.reason instanceof Error
					? result.reason.message
					: String(result.reason)
			}`;
			console.error(`[boundaries] ${message}`);
			failures.push(message);
		}
	});

	return {
		data: Object.fromEntries(results),
		failures,
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
	constituencyLadOverlaps: ConstituencyLadOverlaps | null = null,
): Record<number, BoundaryGeojson | null> => {
	const filtered: Record<number, BoundaryGeojson | null> = {};

	for (const [year, data] of Object.entries(group)) {
		const releaseId =
			type === "constituency"
				? constituencyReleaseIdForYear(Number(year))
				: undefined;
		filtered[Number(year)] = data
			? filterFeatures(
					data,
					location,
					type,
					getLadForWard,
					releaseId
						? constituencyLadOverlaps?.releases[releaseId]
						: undefined,
				)
			: null;
	}

	return filtered;
};

export const getCachedFilteredBoundaryData = (
	rawData: BoundaryData,
	location: string | null,
	getLadForWard?: (wardCode: string) => string | undefined,
	constituencyLadOverlaps: ConstituencyLadOverlaps | null = null,
): BoundaryData => {
	let cache = filteredBoundaryDataCache.get(rawData);
	if (!cache) {
		cache = new Map();
		filteredBoundaryDataCache.set(rawData, cache);
	}

	const cacheKey = location ?? "";
	const cached = cache.get(cacheKey);
	if (cached && cached.constituencyLadOverlaps === constituencyLadOverlaps) {
		// Refresh the entry so the map acts as a least-recently-used cache.
		cache.delete(cacheKey);
		cache.set(cacheKey, cached);
		return cached.data;
	}

	const filteredData = Object.fromEntries(
		BOUNDARY_TYPES.map((type) => [
			type,
			filterBoundaryGroup(
				rawData[type],
				type,
				location,
				getLadForWard,
				constituencyLadOverlaps,
			),
		]),
	) as BoundaryData;

	if (cache.size >= LOCATION_BOUNDARY_CACHE_LIMIT) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey !== undefined) cache.delete(oldestKey);
	}
	cache.set(cacheKey, { data: filteredData, constituencyLadOverlaps });

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
	const [constituencyLadOverlaps, setConstituencyLadOverlaps] =
		useState<ConstituencyLadOverlaps | null>(null);

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
			const overlaps = wanted.includes("constituency")
				? fetchConstituencyLadOverlaps().catch((error) => {
						console.warn(
							"[boundaries] Falling back to constituency bbox filtering:",
							error,
						);
						return null;
					})
				: Promise.resolve(null);

			Promise.all([
				precompiledMappings,
				Promise.all(
					missing.map(async (type) => {
						const { data, failures } =
							await fetchBoundaryGroup(type);
						return [type, data, failures] as const;
					}),
				),
				overlaps,
			])
				.then(([mappings, groups, loadedOverlaps]) => {
					if (!mounted) return;
					if (loadedOverlaps)
						setConstituencyLadOverlaps(loadedOverlaps);

					for (const [type] of groups) loadedTypes.current.add(type);
					const fetched = Object.fromEntries(
						groups.map(([type, data]) => [type, data]),
					) as Partial<
						Record<BoundaryType, Record<number, BoundaryGeojson>>
					>;

					// Whatever did load is still worth drawing, so keep it and
					// report the gaps alongside rather than instead.
					const failures = groups.flatMap(
						([, , groupFailures]) => groupFailures,
					);
					if (failures.length > 0) {
						setError(new Error(failures.join("; ")));
					}

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
						// Ward↔LAD and the cross-year mappings are built from properties
						// and still work here; constituency→ward is matched by shape, so
						// it yields nothing now that these are properties alone. That
						// pairing comes from the precompiled file above, which is the
						// supported path — this remains only as a partial fallback.
						const wardToLad: Record<string, string> = {};
						for (const [year, boundary] of Object.entries(
							fetched.ward,
						)) {
							const wardMappings = extractWardLadMappings(
								boundary.features,
								BOUNDARY_CATALOG.ward.properties.code,
								BOUNDARY_CATALOG.ward.properties.parentCode ??
									BOUNDARY_CATALOG.localAuthority.properties
										.code,
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
		return getCachedFilteredBoundaryData(
			rawData,
			loc,
			getLadForWard,
			constituencyLadOverlaps,
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rawData, loc, constituencyLadOverlaps]);

	const boundaryCodes = useMemo(
		() => extractCodeSets(rawData, isLoading),
		[rawData, isLoading],
	);

	return {
		boundaryData: filteredData,
		boundaryCodes,
		constituencyLadOverlaps,
		isLoading,
		error,
	};
}
