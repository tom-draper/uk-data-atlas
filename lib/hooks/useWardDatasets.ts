import { useEffect, useState, useRef } from 'react';
import { WardGeojson } from '@lib/types';

type Year = '2024' | '2023' | '2022' | '2021';

const GEOJSON_PATHS: Record<Year, string> = {
	'2024': '/data/boundaries/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson',
	'2023': '/data/boundaries/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson',
	'2022': '/data/boundaries/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.geojson',
	'2021': '/data/boundaries/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson',
};

/**
 * Loads and caches Ward boundary GeoJSON data for a specific year
 * 
 * Features:
 * - Automatic caching (won't re-fetch same year)
 * - Loading and error states
 * - Cleanup on unmount
 * 
 * @param year - The boundary year to load ('2024', '2023', '2022', or '2021')
 * @returns Object with geojson data, loading state, and error
 * 
 * @example
 * const { geojson, isLoading, error } = useWardGeoJSON('2024');
 * 
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 * return <Map geojson={geojson} />;
 */
export function useWardData(year: Year | null) {
	const [geojson, setGeojson] = useState<WardGeojson | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);
	const geojsonCache = useRef<Record<string, WardGeojson>>({});

	const fetchGeojson = async (year: Year) => {
		// Return cached if available
		if (geojsonCache.current[year]) {
			console.log(`Using cached ${year} geojson`);
			return geojsonCache.current[year];
		}

		console.log(`EXPENSIVE: Loading ${year} geojson...`);
		const response = await fetch(GEOJSON_PATHS[year]);

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data: WardGeojson = await response.json();
		geojsonCache.current[year] = data;
		console.log(`Storing geojson for ${year}:`, data);

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
				const data = await fetchGeojson(year);
				if (cancelled) return;

				setGeojson(data);
				setIsLoading(false);
			} catch (err) {
				if (!cancelled) {
					const error = err instanceof Error ? err : new Error('Failed to load geojson');
					console.error(`Error loading ${year}:`, error);
					setError(error);
					setIsLoading(false);
				}
			}
		}

		loadGeoJSON();

		return () => {
			cancelled = true;
		};
	}, [year]);

	return { geojson, isLoading, error };
}