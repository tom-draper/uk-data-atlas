// hooks/useBoundaryData.ts
import { useEffect, useState, useMemo } from 'react';
import { BoundaryData, BoundaryGeojson } from '@lib/types';
import {
	BoundaryType,
	fetchBoundaryFile,
	filterFeatures,
	GEOJSON_PATHS,
	PROPERTY_KEYS
} from '../data/boundaries/boundaries';
import { extractWardLadMappings, buildCrossYearMappings } from './useCodeMapper';
import type { CodeMapping, CodeType } from './useCodeMapper';

const EMPTY_BOUNDARY_DATA: BoundaryData = {
	ward: { 2024: null, 2023: null, 2022: null, 2021: null },
	constituency: { 2024: null, 2019: null, 2017: null, 2015: null },
	localAuthority: { 2025: null, 2024: null, 2023: null, 2022: null, 2021: null }
};

/**
 * Fetch all boundary files for a given type
 */
const fetchBoundaryGroup = async (
	type: BoundaryType,
	onMappingsExtracted?: (mappings: Record<string, string>) => void,
	onCrossYearMappings?: (type: CodeType, mappings: CodeMapping) => void
): Promise<Record<number, BoundaryGeojson>> => {
	const paths = GEOJSON_PATHS[type];
	const years = Object.keys(paths).map(Number);

	const results = await Promise.all(
		years.map(async (year) => {
			const path = paths[year as keyof typeof paths];
			const data = await fetchBoundaryFile(path);

			// Extract ward-to-LAD mappings from ward data
			if (type === 'ward' && data.features?.length && onMappingsExtracted) {
				const mappings = extractWardLadMappings(
					data.features,
					PROPERTY_KEYS.wardCode,
					PROPERTY_KEYS.ladCode
				);
				if (Object.keys(mappings).length > 0) {
					onMappingsExtracted(mappings);
				}
			}

			return [year, data] as const;
		})
	);

	const groupedData = Object.fromEntries(results);

	// Build cross-year mappings after all data is loaded
	if (onCrossYearMappings) {
		const crossYearMappings = buildCrossYearMappings(
			groupedData,
			type,
			years
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
	getLadForWard?: (wardCode: string) => string | undefined
): Record<number, BoundaryGeojson | null> => {
	const filtered: Record<number, BoundaryGeojson | null> = {};

	for (const [year, data] of Object.entries(group)) {
		filtered[Number(year)] = data
			? filterFeatures(data, location, type, getLadForWard)
			: null;
	}

	return filtered;
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
		addCodeMappings: (type: CodeType, mappings: CodeMapping) => void;
	}
) {
	const [rawData, setRawData] = useState<BoundaryData>(EMPTY_BOUNDARY_DATA);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	// Extract the individual functions to use as dependencies
	const addWardLadMappings = codeMapper?.addWardLadMappings;
	const addCodeMappings = codeMapper?.addCodeMappings;
	const getLadForWard = codeMapper?.getLadForWard;

	// Load all boundary files on mount
	useEffect(() => {
		let mounted = true;

		const loadBoundaries = async () => {
			try {
				setIsLoading(true);
				setError(null);

				const [wards, constituencies, localAuthorities] = await Promise.all([
					fetchBoundaryGroup(
						'ward',
						addWardLadMappings,
						addCodeMappings
					),
					fetchBoundaryGroup(
						'constituency',
						undefined,
						addCodeMappings
					),
					fetchBoundaryGroup(
						'localAuthority',
						undefined,
						addCodeMappings
					),
				]);

				if (mounted) {
					setRawData({
						ward: wards,
						constituency: constituencies,
						localAuthority: localAuthorities
					});
				}
			} catch (err) {
				if (mounted) {
					setError(err instanceof Error ? err : new Error('Failed to load boundaries'));
				}
			} finally {
				if (mounted) {
					setIsLoading(false);
				}
			}
		};

		loadBoundaries();

		return () => {
			mounted = false;
		};
	}, [addWardLadMappings, addCodeMappings]); // Now uses stable function references

	// Filter data based on selected location
	const filteredData = useMemo(() => {
		if (isLoading || !rawData.ward[2024]) {
			return EMPTY_BOUNDARY_DATA;
		}

		return {
			ward: filterBoundaryGroup(
				rawData.ward,
				'ward',
				selectedLocation || null,
				getLadForWard
			),
			constituency: filterBoundaryGroup(
				rawData.constituency,
				'constituency',
				selectedLocation || null
			),
			localAuthority: filterBoundaryGroup(
				rawData.localAuthority,
				'localAuthority',
				selectedLocation || null
			)
		};
	}, [rawData, selectedLocation, isLoading, getLadForWard]);

	return {
		boundaryData: filteredData,
		isLoading,
		error
	};
}