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

async function fetchGeojson(year: Year): Promise<WardGeojson> {
	const response = await fetch(GEOJSON_PATHS[year]);
	return response.json();
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

	const geojsonCache = useRef<Record<string, WardGeojson>>({});
	const currentGeojsonYear = useRef<string>('');
	const lastProcessedKey = useRef<string>(''); // Track processed combination

	const activeDataset = useMemo(
		() => allDatasets.find(d => d.id === activeDatasetId),
		[allDatasets, activeDatasetId]
	);

	const populationCodes = useMemo(
		() => Object.keys(populationData || {}),
		[populationData]
	);

	// Fetch GeoJSON ONCE per dataset/year
	useEffect(() => {
		let cancelled = false;
		const activeYear = (activeDatasetId in GEOJSON_PATHS ? activeDatasetId : '2024') as Year;

		async function loadGeoJSON() {
			if (geojsonCache.current[activeYear]) {
				console.log('Using cached geojson')
				currentGeojsonYear.current = activeYear;
				setGeojson(geojsonCache.current[activeYear]);
				return;
			}

			setIsLoading(true);
			console.log('Fetching geojson! (expensive)');
			try {
				const data = await fetchGeojson(activeYear);
				if (cancelled) return;

				geojsonCache.current[activeYear] = data;
				currentGeojsonYear.current = activeYear;
				console.log('Storing geojson', data);
				setGeojson(data);
			} catch (err) {
				console.error('Error fetching GeoJSON:', err);
				if (!cancelled) {
					setGeojson(null);
					setIsLoading(false);
				}
			}
		}

		loadGeoJSON();
		return () => {
			cancelled = true;
		};
	}, [activeDatasetId]);

	// Update ward data when dataset changes - but ONLY if geojson matches
	useEffect(() => {
		if (!geojson || !activeDataset) return;
		
		// CRITICAL: Only update if the geojson year matches the dataset year
		const activeYear = (activeDatasetId in GEOJSON_PATHS ? activeDatasetId : '2024') as Year;
		if (currentGeojsonYear.current !== activeYear) {
			console.log('Skipping - geojson/dataset mismatch:', currentGeojsonYear.current, 'vs', activeYear);
			return;
		}

		// Create a unique key for this combination
		const processingKey = `${activeDataset.id}-${currentGeojsonYear.current}-${populationCodes.length}`;
		if (lastProcessedKey.current === processingKey) {
			console.log('Skipping - already processed:', processingKey);
			return;
		}

		console.log('Storing ward data:', activeDataset);
		lastProcessedKey.current = processingKey;
		
		const wardNameMap = buildWardNameToPopCodeMap(geojson, populationCodes);
		
		setWardData(activeDataset.wardData || {});
		setWardResults(activeDataset.wardResults || {});
		setWardNameToPopCode(wardNameMap);
		setIsLoading(false);
	}, [geojson, activeDataset, populationCodes, activeDatasetId]);

	return { geojson, wardData, wardResults, wardNameToPopCode, isLoading };
}