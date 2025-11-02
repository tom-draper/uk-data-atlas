import { useEffect, useState, useRef } from 'react';
import { BoundaryGeojson } from '@lib/types';

export type BoundaryType = 'ward' | 'constituency';
type WardYear = '2024' | '2023' | '2022' | '2021';
type ConstituencyYear = '2024';

const GEOJSON_PATHS = {
	ward: {
		'2024': '/data/boundaries/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson',
		'2023': '/data/boundaries/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson',
		'2022': '/data/boundaries/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.geojson',
		'2021': '/data/boundaries/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson',
	},
	constituency: {
		'2024': '/data/boundaries/constituencies/Westminster_Parliamentary_Constituencies_July_2024_Boundaries_UK_BGC.geojson',
	}
} as const;

/**
 * Loads and caches boundary GeoJSON data for wards or constituencies
 * 
 * Features:
 * - Automatic caching (won't re-fetch same boundary/year combo)
 * - Loading and error states
 * - Cleanup on unmount
 * - Supports both ward and constituency boundaries
 * 
 * @param boundaryType - Type of boundary ('ward' or 'constituency')
 * @param year - The boundary year to load
 * @returns Object with geojson data, loading state, and error
 * 
 * @example
 * // Load ward boundaries
 * const { geojson, isLoading, error } = useBoundaryData('ward', '2024');
 * 
 * // Load constituency boundaries
 * const { geojson, isLoading, error } = useBoundaryData('constituency', '2024');
 * 
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 * return <Map geojson={geojson} />;
 */
export function useBoundaryData(
	boundaryType: BoundaryType,
	year: WardYear | ConstituencyYear | null
) {
	const [geojson, setGeojson] = useState<BoundaryGeojson | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const geojsonCache = useRef<Record<string, BoundaryGeojson>>({});

	const fetchGeojson = async (type: BoundaryType, year: string) => {
		const cacheKey = `${type}-${year}`;
		
		// Return cached if available
		if (geojsonCache.current[cacheKey]) {
			console.log(`Using cached ${type} ${year} geojson`);
			return geojsonCache.current[cacheKey];
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
		geojsonCache.current[cacheKey] = data;
		console.log(`Storing ${type} geojson for ${year}:`, data);
		return data;
	}

	useEffect(() => {
		let cancelled = false;

		async function loadGeoJSON() {
			if (year === null) {
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setError(null);

			try {
				const data = await fetchGeojson(boundaryType, year);
				if (cancelled) return;

				setGeojson(data);
				setIsLoading(false);
			} catch (err) {
				if (!cancelled) {
					const error = err instanceof Error ? err : new Error(`Failed to load ${boundaryType} geojson`);
					console.error(`Error loading ${boundaryType} ${year}:`, error);
					setError(error);
					setIsLoading(false);
				}
			}
		}

		loadGeoJSON();

		return () => {
			cancelled = true;
		};
	}, [boundaryType, year]);

	return { geojson, isLoading, error };
}