import { useMemo } from 'react';
import { BoundaryData, WARD_CODE_KEYS, WARD_NAME_KEYS, WardCodeKey, WardNameKey } from './useBoundaryData';

type WardYear = 2024 | 2023 | 2022 | 2021;

interface WardCodeMapper {
	/**
	 * Convert a ward code from any year to the equivalent code in the target year
	 * @param wardCode - Source ward code (from any year)
	 * @param targetYear - Desired year for the output code
	 * @returns Ward code for the target year, or null if not found
	 */
	convertWardCode: (wardCode: string, targetYear: WardYear) => string | null;

	/**
	 * Get the ward name for a given ward code
	 */
	getWardName: (wardCode: string) => string | null;

	/**
	 * Get all ward codes for a given ward name across all years
	 */
	getWardCodesByName: (wardName: string) => Partial<Record<WardYear, string>>;
}

/**
 * Creates a bidirectional mapping between ward codes across different years using ward names.
 * 
 * Ward codes changed in 2023, so this hook allows you to convert between old and new codes.
 * For example: "Bowdon" is E05015241 (2023/2024) but E05000821 (2021/2022)
 * 
 * @param boundaryData - Boundary data from useBoundaryData
 * @returns Ward code mapper utility
 * 
 * @example
 * const mapper = useWardCodeMapper(boundaryData);
 * const code2024 = mapper.convertWardCode('E05000821', 2024); // Returns 'E05015241'
 * const code2022 = mapper.convertWardCode('E05015241', 2022); // Returns 'E05000821'
 */
export function useWardCodeMapper(boundaryData: BoundaryData): WardCodeMapper {
	const mapper = useMemo(() => {
		// Map: ward name -> { year -> ward code }
		const nameToCodesMap = new Map<string, Partial<Record<WardYear, string>>>();
		
		// Map: ward code -> ward name
		const codeToNameMap = new Map<string, string>();

		const years: WardYear[] = [2024, 2023, 2022, 2021];

		years.forEach(year => {
			const geojson = boundaryData.ward[year];
			if (!geojson) return;

			const firstFeature = geojson.features[0];
			if (!firstFeature) return;

			// Find the appropriate property keys for this year
			const wardCodeKey = WARD_CODE_KEYS.find(key => key in firstFeature.properties) as WardCodeKey | undefined;
			const wardNameKey = WARD_NAME_KEYS.find(key => key in firstFeature.properties) as WardNameKey | undefined;

			if (!wardCodeKey || !wardNameKey) return;

			geojson.features.forEach(feature => {
				const wardCode = feature.properties[wardCodeKey];
				const wardName = feature.properties[wardNameKey];

				if (!wardCode || !wardName) return;

				// Normalize ward name (trim, lowercase for consistency)
				const normalizedName = wardName.trim().toLowerCase();

				// Build name -> codes mapping
				if (!nameToCodesMap.has(normalizedName)) {
					nameToCodesMap.set(normalizedName, {});
				}
				nameToCodesMap.get(normalizedName)![year] = wardCode;

				// Build code -> name mapping
				codeToNameMap.set(wardCode, wardName);
			});
		});

		return { nameToCodesMap, codeToNameMap };
	}, [boundaryData]);

	const convertWardCode = (wardCode: string, targetYear: WardYear): string | null => {
		// Get the ward name from the source code
		const wardName = mapper.codeToNameMap.get(wardCode);
		if (!wardName) return null;

		// Get all codes for this ward
		const normalizedName = wardName.trim().toLowerCase();
		const codes = mapper.nameToCodesMap.get(normalizedName);
		if (!codes) return null;

		// Return the code for the target year
		return codes[targetYear] || null;
	};

	const getWardName = (wardCode: string): string | null => {
		return mapper.codeToNameMap.get(wardCode) || null;
	};

	const getWardCodesByName = (wardName: string): Partial<Record<WardYear, string>> => {
		const normalizedName = wardName.trim().toLowerCase();
		return mapper.nameToCodesMap.get(normalizedName) || {};
	};

	return {
		convertWardCode,
		getWardName,
		getWardCodesByName
	};
}
