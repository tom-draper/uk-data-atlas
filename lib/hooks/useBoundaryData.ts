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
export type WardCodeKey = (typeof WARD_CODE_KEYS)[number];

export const LAD_CODE_KEYS = ['LAD24CD', 'LAD23CD', 'LAD22CD', 'LAD21CD'] as const;
export type LadCodeKey = (typeof LAD_CODE_KEYS)[number];

/**
 * Loads all boundary GeoJSON files and returns them filtered by location.
 * Full datasets cached once, filtered data returned per location.
 * 
 * @param selectedLocation - Optional location name to filter features by
 * @returns All boundary data filtered for location, loading state, and error
 * 
 * @example
 * const { boundaryData, isLoading } = useBoundaryData('Greater Manchester');
 * // boundaryData.ward[2024] = only Greater Manchester 2024 wards
 * // boundaryData.ward[2023] = only Greater Manchester 2023 wards
 * // etc.
 */
export function useBoundaryData(selectedLocation?: string | null) {
	const [boundaryData, setBoundaryData] = useState<BoundaryData>({
		ward: { 
			2024: null, 
			2023: null, 
			2022: null, 
			2021: null
		},
		constituency: { 2024: null }
	});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	
	// Cache full datasets
	const fullGeojsonCache = useRef<Record<string, BoundaryGeojson>>({});

	const fetchGeojson = async (type: BoundaryType, year: number): Promise<BoundaryGeojson> => {
		const cacheKey = `${type}-${year}`;
		
		if (fullGeojsonCache.current[cacheKey]) {
			console.log(`Using cached ${type} ${year} geojson`);
			return fullGeojsonCache.current[cacheKey];
		}

		console.log(`EXPENSIVE: Loading ${type} ${year} geojson...`);
		
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
		console.log(`Cached full ${type} geojson for ${year}: ${data.features.length} features`);
		return data;
	};

	const filterGeojsonByLocation = (
		fullGeojson: BoundaryGeojson,
		location: string | null | undefined,
		type: BoundaryType
	): BoundaryGeojson => {
		if (!location) return fullGeojson;
		const locationData = LOCATIONS[location];
		if (!locationData || !locationData.lad_codes) return fullGeojson;

		const ladCodes = locationData.lad_codes;

		// For wards, filter by LAD codes
		if (type === 'ward') {
			const firstFeature = fullGeojson.features[0];
			const ladCodeProp = LAD_CODE_KEYS.find(key => key in (firstFeature?.properties || {})) || LAD_CODE_KEYS[0];

			const filtered = fullGeojson.features.filter((feature: any) => {
				const ladCode = feature.properties[ladCodeProp];
				return ladCodes.includes(ladCode);
			});

			console.log(`Filtered ${location} ${type}: ${filtered.length}/${fullGeojson.features.length}`);

			return {
				type: 'FeatureCollection',
				features: filtered
			};
		}

		// For constituencies, return all for now
		return fullGeojson;
	};

	useEffect(() => {
		let cancelled = false;

		async function loadAllBoundaries() {
			setIsLoading(true);
			setError(null);

			try {
				// Load all ward years
				const [ward2024, ward2023, ward2022, ward2021, constituency2024] = await Promise.all([
					fetchGeojson('ward', 2024),
					fetchGeojson('ward', 2023),
					fetchGeojson('ward', 2022),
					fetchGeojson('ward', 2021),
					fetchGeojson('constituency', 2024),
				]);

				if (cancelled) return;

				// Filter by location if provided
				const filtered: BoundaryData = {
					ward: {
						2024: filterGeojsonByLocation(ward2024, selectedLocation, 'ward'),
						2023: filterGeojsonByLocation(ward2023, selectedLocation, 'ward'),
						2022: filterGeojsonByLocation(ward2022, selectedLocation, 'ward'),
						2021: filterGeojsonByLocation(ward2021, selectedLocation, 'ward'),
					},
					constituency: {
						2024: filterGeojsonByLocation(constituency2024, selectedLocation, 'constituency'),
					}
				};

				setBoundaryData(filtered);
				setIsLoading(false);
			} catch (err) {
				if (!cancelled) {
					const error = err instanceof Error ? err : new Error('Failed to load boundary data');
					console.error('Error loading boundaries:', error);
					setError(error);
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