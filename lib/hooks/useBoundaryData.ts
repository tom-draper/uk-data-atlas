import { useEffect, useState, useRef } from 'react';
import { BoundaryGeojson } from '@lib/types';
import { LOCATIONS } from '@lib/data/locations';

const GEOJSON_PATHS = {
	ward: {
		2024: '/data/boundaries/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson',
		2023: '/data/boundaries/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson',
		2022: '/data/boundaries/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.geojson',
		2021: '/data/boundaries/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson',
	},
	constituency: {
		2024: '/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC_-8097874740651686118.geojson',
		2019: '/data/boundaries/constituencies/WPC_Dec_2019_GCB_UK_2022_-6554439877584414509.geojson',
		2017: '/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_Dec_2017_UK_BGC_2022_-4428297854860494183.geojson',
		2015: '/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_Dec_2017_UK_BGC_2022_-4428297854860494183.geojson',
	}
} as const;

export type BoundaryType = keyof typeof GEOJSON_PATHS;
export type WardYear = keyof typeof GEOJSON_PATHS['ward'] & number;
export type ConstituencyYear = keyof typeof GEOJSON_PATHS['constituency'] & number;
export type BoundaryYears<T extends BoundaryType> = keyof typeof GEOJSON_PATHS[T] & number;

type BoundaryYearMap<T extends BoundaryType> = {
	[Y in BoundaryYears<T>]: BoundaryGeojson | null;
};

export type BoundaryData = {
	[T in BoundaryType]: BoundaryYearMap<T>;
};

export const WARD_CODE_KEYS = ['WD24CD', 'WD23CD', 'WD22CD', 'WD21CD'] as const;
export const WARD_NAME_KEYS = ['WD24NM', 'WD23NM', 'WD22NM', 'WD21NM'] as const;
export const LAD_CODE_KEYS = ['LAD24CD', 'LAD23CD', 'LAD22CD', 'LAD21CD'] as const;
export const CONSTITUENCY_CODE_KEYS = ['PCON24CD', 'PCON19CD', 'PCON17CD', 'PCON15CD'] as const;
export const CONSTITUENCY_NAME_KEYS = ['PCON24NM', 'PCON19NM', 'PCON17NM', 'PCON15NM'] as const;

export type WardCodeKey = (typeof WARD_CODE_KEYS)[number];
export type WardNameKey = (typeof WARD_NAME_KEYS)[number];
export type LadCodeKey = (typeof LAD_CODE_KEYS)[number];
export type ConstituencyCodeKey = (typeof CONSTITUENCY_CODE_KEYS)[number];
export type ConstituencyNameKey = (typeof CONSTITUENCY_NAME_KEYS)[number];

const WARD_YEARS = [2024, 2023, 2022, 2021] as const;
const CONSTITUENCY_YEARS = [2024, 2019, 2017, 2015] as const;

const COUNTRY_PREFIXES: Record<string, string> = {
	'England': 'E',
	'Scotland': 'S',
	'Wales': 'W',
	'Northern Ireland': 'N'
};

const COUNTRY_LOCATIONS = new Set(['England', 'Scotland', 'Wales', 'Northern Ireland', 'United Kingdom']);

/**
 * Loads all boundary GeoJSON files and returns them filtered by location.
 * Full datasets cached once, filtered data returned per location.
 */
export function useBoundaryData(selectedLocation?: string | null) {
	const [boundaryData, setBoundaryData] = useState<BoundaryData>({
		ward: { 2024: null, 2023: null, 2022: null, 2021: null },
		constituency: { 2024: null, 2019: null, 2017: null, 2015: null }
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const wardToLadCodeMap = useRef<Record<string, string>>({});
	const fullGeojsonCache = useRef<Record<string, BoundaryGeojson>>({});

	const fetchGeojson = async (type: BoundaryType, year: number): Promise<BoundaryGeojson> => {
		const cacheKey = `${type}-${year}`;

		if (fullGeojsonCache.current[cacheKey]) {
			return fullGeojsonCache.current[cacheKey];
		}

		const paths = GEOJSON_PATHS[type];
		const path = paths[year as keyof typeof paths];

		if (!path) {
			throw new Error(`No boundary data available for ${type} ${year}`);
		}

		const response = await fetch(path);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: BoundaryGeojson = await response.json();
		fullGeojsonCache.current[cacheKey] = data;
		return data;
	};

	const findPropertyKey = <T extends readonly string[]>(
		properties: Record<string, any>,
		keys: T
	): T[number] | undefined => {
		return keys.find(key => key in properties);
	};

	const updateWardToLadCodeMap = (geojson: BoundaryGeojson) => {
		const firstFeature = geojson.features[0];
		if (!firstFeature) return;

		const ladCodeProp = findPropertyKey(firstFeature.properties, LAD_CODE_KEYS);
		const wardCodeProp = findPropertyKey(firstFeature.properties, WARD_CODE_KEYS);

		if (ladCodeProp && wardCodeProp) {
			geojson.features.forEach((feature: any) => {
				const wardCode = feature.properties[wardCodeProp];
				const ladCode = feature.properties[ladCodeProp];
				if (wardCode && ladCode) {
					wardToLadCodeMap.current[wardCode] = ladCode;
				}
			});
		}
	};

	const filterByCountry = (
		features: any[],
		location: string,
		codeProperty: string
	): any[] => {
		// United Kingdom = no filtering
		if (location === 'United Kingdom') {
			return features;
		}

		const prefix = COUNTRY_PREFIXES[location];
		if (!prefix) return features;

		return features.filter((feature: any) => {
			const code = feature.properties[codeProperty];
			return code && code.startsWith(prefix);
		});
	};

	const filterWardsByLadCodes = (
		features: any[],
		ladCodes: string[],
		wardCodeProp: string,
		ladCodeProp: string | undefined
	): any[] => {
		return features.filter((feature: any) => {
			const wardCode = feature.properties[wardCodeProp];
			const ladCode = feature.properties[ladCodeProp] || wardToLadCodeMap.current[wardCode];
			return ladCodes.includes(ladCode);
		});
	};

	const filterConstituenciesByBounds = (
		features: any[],
		bounds: [number, number, number, number]
	): any[] => {
		const [west, south, east, north] = bounds;

		return features.filter((feature: any) => {
			const geometry = feature.geometry;
			if (!geometry || !geometry.coordinates) return false;

			// Extract coordinates based on geometry type
			let coordinates: number[][][] = [];
			
			if (geometry.type === 'Polygon') {
				coordinates = [geometry.coordinates];
			} else if (geometry.type === 'MultiPolygon') {
				coordinates = geometry.coordinates;
			} else {
				return false;
			}

			// Check if any point of the constituency falls within bounds
			for (const polygon of coordinates) {
				for (const ring of polygon) {
					for (const [lng, lat] of ring) {
						if (lng >= west && lng <= east && lat >= south && lat <= north) {
							return true;
						}
					}
				}
			}

			return false;
		});
	};

	const filterGeojsonByLocation = (
		fullGeojson: BoundaryGeojson,
		location: string | null | undefined,
		type: BoundaryType
	): BoundaryGeojson => {
		if (!location) return fullGeojson;

		const firstFeature = fullGeojson.features[0];
		if (!firstFeature) return fullGeojson;

		let filteredFeatures = fullGeojson.features;

		// Filter by country prefix
		if (COUNTRY_LOCATIONS.has(location)) {
			const codeProperty = type === 'ward' 
				? findPropertyKey(firstFeature.properties, WARD_CODE_KEYS)
				: findPropertyKey(firstFeature.properties, CONSTITUENCY_CODE_KEYS);

			if (codeProperty) {
				filteredFeatures = filterByCountry(filteredFeatures, location, codeProperty);
			}

			return {
				type: 'FeatureCollection',
				features: filteredFeatures
			};
		}

		// Filter by specific location
		const locationData = LOCATIONS[location];
		if (!locationData) return fullGeojson;

		if (type === 'ward' && locationData.lad_codes && locationData.lad_codes.length > 0) {
			const wardCodeProp = findPropertyKey(firstFeature.properties, WARD_CODE_KEYS);
			const ladCodeProp = findPropertyKey(firstFeature.properties, LAD_CODE_KEYS);

			if (wardCodeProp) {
				filteredFeatures = filterWardsByLadCodes(
					filteredFeatures,
					locationData.lad_codes,
					wardCodeProp,
					ladCodeProp
				);
			}
		} else if (type === 'constituency' && locationData.bounds) {
			// Filter constituencies by geographic bounds
			filteredFeatures = filterConstituenciesByBounds(filteredFeatures, locationData.bounds);
		}

		return {
			type: 'FeatureCollection',
			features: filteredFeatures
		};
	};

	useEffect(() => {
		let cancelled = false;

		async function loadAllBoundaries() {
			setIsLoading(true);
			setError(null);

			try {
				const wardPromises = WARD_YEARS.map(year => fetchGeojson('ward', year));
				const constituencyPromises = CONSTITUENCY_YEARS.map(year => fetchGeojson('constituency', year));

				const [wardGeojsons, constituencyGeojsons] = await Promise.all([
					Promise.all(wardPromises),
					Promise.all(constituencyPromises)
				]);

				if (cancelled) return;

				// Update ward to LAD code map
				wardGeojsons.forEach(updateWardToLadCodeMap);

				// Filter by location
				const filtered: BoundaryData = {
					ward: Object.fromEntries(
						WARD_YEARS.map((year, idx) => [
							year,
							filterGeojsonByLocation(wardGeojsons[idx], selectedLocation, 'ward')
						])
					) as BoundaryYearMap<'ward'>,
					constituency: Object.fromEntries(
						CONSTITUENCY_YEARS.map((year, idx) => [
							year,
							filterGeojsonByLocation(constituencyGeojsons[idx], selectedLocation, 'constituency')
						])
					) as BoundaryYearMap<'constituency'>
				};

				setBoundaryData(filtered);
			} catch (err) {
				if (!cancelled) {
					const error = err instanceof Error ? err : new Error('Failed to load boundary data');
					console.error('Error loading boundaries:', error);
					setError(error);
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}

		loadAllBoundaries();

		return () => {
			cancelled = true;
		};
	}, [selectedLocation]);

	return { boundaryData, isLoading, error };
}