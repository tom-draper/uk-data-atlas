import { useEffect, useState, useMemo, useRef } from 'react';
import type { Dataset, PopulationWardData } from '@lib/types';

type Year = '2024' | '2023' | '2022' | '2021';

export interface WardGeojson {
	features: Array<{
		properties: {
			WD24CD?: string;
			WD23CD?: string;
			WD22CD?: string;
			WD21CD?: string;
			WD23NM?: string;
		};
	}>;
}

interface WardDatasets {
	geojson: WardGeojson | null;
	wardData: any | null;
	wardResults: any | null;
	wardNameToPopCode: Record<string, string>;
	isLoading: boolean;
}

const GEOJSON_PATHS: Record<Year, string> = {
	'2024': '/data/wards/Wards_December_2024_Boundaries_UK_BGC_-2654605954884295357.geojson',
	'2023': '/data/wards/Wards_December_2023_Boundaries_UK_BGC_-915726682161155301.geojson',
	'2022': '/data/wards/Wards_December_2022_Boundaries_UK_BGC_-898530251172766412.geojson',
	'2021': '/data/wards/Wards_December_2021_UK_BGC_2022_-3127229614810050524.geojson',
};

// Shared cache across all hook instances
const geojsonCache: Record<Year, WardGeojson> = {} as Record<Year, WardGeojson>;

async function fetchGeojson(year: Year): Promise<WardGeojson> {
	// Return cached if available
	if (geojsonCache[year]) {
		console.log(`Using cached ${year} geojson`);
		return geojsonCache[year];
	}

	console.log(`EXPENSIVE: Loading ${year} geojson...`);
	const response = await fetch(GEOJSON_PATHS[year]);
	
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}
	
	const data: WardGeojson = await response.json();
	geojsonCache[year] = data;
	console.log(`Storing geojson for ${year}:`, data);
	
	return data;
}

function buildWardNameToPopCodeMap(
	geojson: WardGeojson,
	populationCodes: string[]
): Record<string, string> {
	const map: Record<string, string> = {};
	for (const wardCode of populationCodes) {
		const feature = geojson.features.find(f =>
			f.properties.WD24CD === wardCode ||
			f.properties.WD23CD === wardCode ||
			f.properties.WD22CD === wardCode ||
			f.properties.WD21CD === wardCode
		);
		if (feature) {
			const name = (feature.properties.WD23NM || '').toLowerCase().trim();
			if (name) map[name] = wardCode;
		}
	}
	return map;
}

export function useWardDatasets(
	allDatasets: Dataset[],
	activeDatasetId: string,
	populationData: PopulationWardData
): WardDatasets {
	const [geojson, setGeojson] = useState<WardGeojson | null>(null);
	const [wardData, setWardData] = useState<any | null>(null);
	const [wardResults, setWardResults] = useState<any | null>(null);
	const [wardNameToPopCode, setWardNameToPopCode] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(true);

	const currentGeojsonYear = useRef<string>('');
	const lastProcessedKey = useRef<string>('');

	const activeDataset = useMemo(
		() => allDatasets.find(d => d.id === activeDatasetId),
		[allDatasets, activeDatasetId]
	);

	const populationCodes = useMemo(
		() => Object.keys(populationData || {}),
		[populationData]
	);

	useEffect(() => {
		let cancelled = false;
		const activeYear = (activeDatasetId in GEOJSON_PATHS ? activeDatasetId : '2024') as Year;

		async function loadGeojson() {
			setIsLoading(true);
			try {
				const data = await fetchGeojson(activeYear);
				if (cancelled) return;

				currentGeojsonYear.current = activeYear;
				setGeojson(data);
			} catch (err) {
				console.error('Error fetching geojson:', err);
				if (!cancelled) {
					setGeojson(null);
					setIsLoading(false);
				}
			}
		}

		loadGeojson();
		return () => {
			cancelled = true;
		};
	}, [activeDatasetId]);

	useEffect(() => {
		if (!geojson || !activeDataset) return;
		
		const activeYear = (activeDatasetId in GEOJSON_PATHS ? activeDatasetId : '2024') as Year;
		if (currentGeojsonYear.current !== activeYear) {
			return;
		}

		const processingKey = `${activeDataset.id}-${currentGeojsonYear.current}-${populationCodes.length}`;
		if (lastProcessedKey.current === processingKey) {
			return;
		}

		lastProcessedKey.current = processingKey;
		
		const wardNameMap = buildWardNameToPopCodeMap(geojson, populationCodes);
		
		setWardData(activeDataset.wardData || {});
		setWardResults(activeDataset.wardResults || {});
		setWardNameToPopCode(wardNameMap);
		setIsLoading(false);
	}, [geojson, activeDataset, populationCodes, activeDatasetId]);

	return { geojson, wardData, wardResults, wardNameToPopCode, isLoading };
}

interface UseWardGeojsonResult {
	geojson: WardGeojson | null;
	isLoading: boolean;
	error: Error | null;
}

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
export function useWardGeojson(year: Year | null): UseWardGeojsonResult {
	const [geojson, setGeojson] = useState<WardGeojson | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

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