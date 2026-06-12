// hooks/useBoundaryData.ts
import { startTransition, useEffect, useMemo, useState } from "react";
import { BoundaryCodes, BoundaryData, BoundaryGeojson } from "@lib/types";
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

/**
 * Fetch all boundary files for a given type
 */
const fetchBoundaryGroup = async (
	type: BoundaryType,
	onMappingsExtracted?: (mappings: Record<string, string>) => void,
	onLadWardMappingsExtracted?: (
		year: YearCode,
		mappings: Record<string, string[]>,
	) => void,
	onCrossYearMappings?: (type: CodeType, mappings: CodeMapping) => void,
): Promise<Record<number, BoundaryGeojson>> => {
	const paths = GEOJSON_PATHS[type];
	const years = Object.keys(paths).map(Number);

	const allWardLadMappings: Record<string, string> = {};
	const allLadWardMappings: Record<YearCode, Record<string, string[]>> = {};

	const settled = await Promise.allSettled(
		years.map(async (year) => {
			const path = paths[year as keyof typeof paths];
			const data = await fetchBoundaryFile(path);

			if (type === "ward" && data.features?.length) {
				const { wardToLad, ladToWards } = extractWardLadMappings(
					data.features,
					PROPERTY_KEYS.wardCode,
					PROPERTY_KEYS.ladCode,
				);
				Object.assign(allWardLadMappings, wardToLad);
				if (Object.keys(ladToWards).length > 0) {
					allLadWardMappings[year] = ladToWards;
				}
			}

			return [year, data] as const;
		}),
	);

	settled.forEach((r, i) => {
		if (r.status === "rejected") {
			console.error(`[boundaries] Failed to load ${type} year ${years[i]}:`, r.reason);
		}
	});

	const results = settled
		.filter((r): r is PromiseFulfilledResult<readonly [number, BoundaryGeojson]> => r.status === "fulfilled")
		.map((r) => r.value);

	// Dispatch all ward-LAD mappings in a single call to avoid multiple state updates
	if (onMappingsExtracted && Object.keys(allWardLadMappings).length > 0) {
		onMappingsExtracted(allWardLadMappings);
	}
	for (const [year, mappings] of Object.entries(allLadWardMappings)) {
		onLadWardMappingsExtracted?.(Number(year), mappings);
	}

	const groupedData = Object.fromEntries(results);

	// Build cross-year mappings after all data is loaded
	if (onCrossYearMappings) {
		const crossYearMappings = buildCrossYearMappings(
			groupedData,
			type,
			years,
		);

		if (Object.keys(crossYearMappings).length > 0) {
			onCrossYearMappings(type, crossYearMappings);
		}
	}

	return groupedData;
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

			Promise.all([
				fetchBoundaryGroup(
					"ward",
					addWardLadMappings,
					addLadWardMappings,
					addCodeMappings,
				),
				fetchBoundaryGroup(
					"constituency",
					undefined,
					undefined,
					addCodeMappings,
				),
				fetchBoundaryGroup(
					"localAuthority",
					undefined,
					undefined,
					addCodeMappings,
				),
				fetchBoundaryGroup("lsoa").catch(
					() => ({}) as Record<number, BoundaryGeojson>,
				),
				fetchBoundaryGroup("dataZone").catch(
					() => ({}) as Record<number, BoundaryGeojson>,
				),
				fetchBoundaryGroup("superOutputArea").catch(
					() => ({}) as Record<number, BoundaryGeojson>,
				),
			])
				.then(([wards, constituencies, localAuthorities, lsoas, dataZones, superOutputAreas]) => {
					if (!mounted) return;

					startTransition(() => {
						setRawData({
							ward: wards,
							constituency: constituencies,
							localAuthority: localAuthorities,
							lsoa: lsoas,
							dataZone: dataZones,
							superOutputArea: superOutputAreas,
						});
					});

					// Build constituency->wards mappings for each (ward year, constituency year) pair.
					// Building for ALL available constituency boundary years ensures that hovering
					// on constituencies from any GE (2019, 2024, etc.) resolves directly without
					// needing a cross-year constituency code lookup. Constituencies that were
					// renamed or redrawn in 2024 have no PCON19CD→PCON24CD name mapping, so
					// they'd return [] if we only indexed by PCON24CD.
					if (addConstituencyWardMappings) {
						const constituencyEntries = Object.entries(constituencies)
							.filter(([, conData]) => conData?.features);
						// Only build for the latest ward year — ward highlighting always
						// uses current boundaries, so historical ward years are not needed.
						const latestWardYear = Math.max(
							...Object.keys(wards).map(Number).filter(y => wards[y]?.features),
						);
						const latestWardData = wards[latestWardYear];
						if (latestWardData?.features) {
							const mergedMappings: Record<string, string[]> = {};
							for (const [, conData] of constituencyEntries) {
								const mappings = buildConstituencyWardMappings(latestWardData, conData!);
								Object.assign(mergedMappings, mappings);
							}
							if (Object.keys(mergedMappings).length > 0) {
								addConstituencyWardMappings(latestWardYear, mergedMappings);
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
		return {
			ward: filterBoundaryGroup(rawData.ward, "ward", loc, getLadForWard),
			constituency: filterBoundaryGroup(rawData.constituency, "constituency", loc),
			localAuthority: filterBoundaryGroup(rawData.localAuthority, "localAuthority", loc),
			lsoa: filterBoundaryGroup(rawData.lsoa, "lsoa", loc),
			dataZone: filterBoundaryGroup(rawData.dataZone, "dataZone", loc),
			superOutputArea: filterBoundaryGroup(rawData.superOutputArea, "superOutputArea", loc),
		};
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
