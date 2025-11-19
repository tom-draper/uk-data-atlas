import { useMemo } from 'react';
import { BoundaryData } from './useBoundaryData';
import { CONSTITUENCY_CODE_KEYS, CONSTITUENCY_NAME_KEYS, ConstituencyCodeKey, ConstituencyNameKey, ConstituencyYear, WARD_CODE_KEYS, WARD_NAME_KEYS, WardCodeKey, WardNameKey, WardYear } from '../data/boundaries/boundaries';

export interface CodeMapper {
	/**
	 * Convert a ward code from any year to the equivalent code in the target year
	 * @param wardCode - Source ward code (from any year)
	 * @param targetYear - Desired year for the output code
	 * @returns Ward code for the target year, or null if not found
	 */
	convertWardCode: (wardCode: string, targetYear: WardYear) => string | null;

	/**
	 * Convert a constituency code from any year to the equivalent code in the target year
	 * @param constituencyCode - Source constituency code (from any year)
	 * @param targetYear - Desired year for the output code
	 * @returns Constituency code for the target year, or null if not found
	 */
	convertConstituencyCode: (constituencyCode: string, targetYear: ConstituencyYear) => string | null;

	/**
	 * Get the ward name for a given ward code
	 */
	getWardName: (wardCode: string) => string | null;

	/**
	 * Get the constituency name for a given constituency code
	 */
	getConstituencyName: (constituencyCode: string) => string | null;

	/**
	 * Get all ward codes for a given ward name across all years
	 */
	getWardCodesByName: (wardName: string) => Partial<Record<WardYear, string>>;

	/**
	 * Get all constituency codes for a given constituency name across all years
	 */
	getConstituencyCodesByName: (constituencyName: string) => Partial<Record<ConstituencyYear, string>>;
}

/**
 * Creates a bidirectional mapping between ward and constituency codes across different years.
 * 
 * Ward codes changed in 2023, and constituency boundaries changed in 2024.
 * This hook allows you to convert between old and new codes for both.
 * 
 * @param boundaryData - Boundary data from useBoundaryData
 * @returns Code mapper utility
 * 
 * @example
 * const mapper = useCodeMapper(boundaryData);
 * 
 * // Convert ward codes
 * const wardCode2024 = mapper.convertWardCode('E05000821', 2024);
 * const wardCode2022 = mapper.convertWardCode('E05015241', 2022);
 * 
 * // Convert constituency codes
 * const constCode2024 = mapper.convertConstituencyCode('E14000123', 2024);
 * const constCode2019 = mapper.convertConstituencyCode('E14000456', 2019);
 */
export function useCodeMapper(boundaryData: BoundaryData): CodeMapper {
	const wardMapper = useMemo(() => {
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

	const constituencyMapper = useMemo(() => {
		// Map: constituency name -> { year -> constituency code }
		const nameToCodesMap = new Map<string, Partial<Record<ConstituencyYear, string>>>();
		
		// Map: constituency code -> constituency name
		const codeToNameMap = new Map<string, string>();

		const years: ConstituencyYear[] = [2024, 2019, 2017, 2015];

		years.forEach(year => {
			const geojson = boundaryData.constituency[year];
			if (!geojson) return;

			const firstFeature = geojson.features[0];
			if (!firstFeature) return;

			// Find the appropriate property keys for this year
			const constituencyCodeKey = CONSTITUENCY_CODE_KEYS.find(key => key in firstFeature.properties) as ConstituencyCodeKey | undefined;
			const constituencyNameKey = CONSTITUENCY_NAME_KEYS.find(key => key in firstFeature.properties) as ConstituencyNameKey | undefined;

			if (!constituencyCodeKey || !constituencyNameKey) return;

			geojson.features.forEach(feature => {
				const constituencyCode = feature.properties[constituencyCodeKey];
				const constituencyName = feature.properties[constituencyNameKey];

				if (!constituencyCode || !constituencyName) return;

				// Normalize constituency name (trim, lowercase for consistency)
				const normalizedName = constituencyName.trim().toLowerCase();

				// Build name -> codes mapping
				if (!nameToCodesMap.has(normalizedName)) {
					nameToCodesMap.set(normalizedName, {});
				}
				nameToCodesMap.get(normalizedName)![year] = constituencyCode;

				// Build code -> name mapping
				codeToNameMap.set(constituencyCode, constituencyName);
			});
		});

		return { nameToCodesMap, codeToNameMap };
	}, [boundaryData]);

	const convertWardCode = (wardCode: string, targetYear: WardYear): string | null => {
		// Get the ward name from the source code
		const wardName = wardMapper.codeToNameMap.get(wardCode);
		if (!wardName) return null;

		// Get all codes for this ward
		const normalizedName = wardName.trim().toLowerCase();
		const codes = wardMapper.nameToCodesMap.get(normalizedName);
		if (!codes) return null;

		// Return the code for the target year
		return codes[targetYear] || null;
	};

	const convertConstituencyCode = (constituencyCode: string, targetYear: ConstituencyYear): string | null => {
		// Get the constituency name from the source code
		const constituencyName = constituencyMapper.codeToNameMap.get(constituencyCode);
		if (!constituencyName) return null;

		// Get all codes for this constituency
		const normalizedName = constituencyName.trim().toLowerCase();
		const codes = constituencyMapper.nameToCodesMap.get(normalizedName);
		if (!codes) return null;

		// Return the code for the target year
		return codes[targetYear] || null;
	};

	const getWardName = (wardCode: string): string | null => {
		return wardMapper.codeToNameMap.get(wardCode) || null;
	};

	const getConstituencyName = (constituencyCode: string): string | null => {
		return constituencyMapper.codeToNameMap.get(constituencyCode) || null;
	};

	const getWardCodesByName = (wardName: string): Partial<Record<WardYear, string>> => {
		const normalizedName = wardName.trim().toLowerCase();
		return wardMapper.nameToCodesMap.get(normalizedName) || {};
	};

	const getConstituencyCodesByName = (constituencyName: string): Partial<Record<ConstituencyYear, string>> => {
		const normalizedName = constituencyName.trim().toLowerCase();
		return constituencyMapper.nameToCodesMap.get(normalizedName) || {};
	};

	return {
		convertWardCode,
		convertConstituencyCode,
		getWardName,
		getConstituencyName,
		getWardCodesByName,
		getConstituencyCodesByName
	};
}