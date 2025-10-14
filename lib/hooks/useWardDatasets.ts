import { useEffect, useState, useMemo } from 'react';
import type { Dataset } from '@/lib/types';

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

const WARD_CODE_PROPERTIES: Record<Year, string> = {
	'2024': 'WD24CD',
	'2023': 'WD23CD',
	'2022': 'WD22CD',
	'2021': 'WD21CD',
};

/**
 * Fetches a single ward boundary GeoJSON file for the specified year
 */
async function fetchGeojson(year: Year): Promise<WardGeojson> {
	const response = await fetch(GEOJSON_PATHS[year]);
	return response.json();
}

/**
 * Builds a map of ward names to population codes
 */
function buildWardNameToPopCodeMap(
	geojson: WardGeojson,
	populationCodes: string[]
): Record<string, string> {
	const map: Record<string, string> = {};

	for (const wardCode of populationCodes) {
		const feature = geojson.features.find((f) =>
			f.properties.WD24CD === wardCode ||
			f.properties.WD23CD === wardCode ||
			f.properties.WD22CD === wardCode ||
			f.properties.WD21CD === wardCode
		);

		if (feature) {
			const name = (feature.properties.WD23NM || '').toLowerCase().trim();
			if (name) {
				map[name] = wardCode;
			}
		}
	}

	return map;
}

/**
 * Hook to manage ward datasets, including GeoJSON boundaries and election data
 */
export function useWardDatasets(
	allDatasets: Dataset[],
	activeDatasetId: string,
	populationDatasets: any[]
): WardDatasets {
	const [geojson, setGeojson] = useState<WardGeojson | null>(null);
	const [wardData, setWardData] = useState<any | null>(null);
	const [wardResults, setWardResults] = useState<any | null>(null);
	const [wardNameToPopCode, setWardNameToPopCode] = useState<Record<string, string>>({});
	const [isLoading, setIsLoading] = useState(true);

	// Memoize dataset lookups to avoid recalculation
	const datasetsByYear = useMemo(() => ({
		'2024': allDatasets.find(d => d.id === '2024'),
		'2023': allDatasets.find(d => d.id === '2023'),
		'2022': allDatasets.find(d => d.id === '2022'),
		'2021': allDatasets.find(d => d.id === '2021'),
	}), [allDatasets]);

	useEffect(() => {
		console.log('useWardDatasets', activeDatasetId);
		let cancelled = false;
		setIsLoading(true);

		async function loadAll() {
			try {
				console.log('loadAll');
				// Determine which year to load
				const activeYear = (activeDatasetId in GEOJSON_PATHS ? activeDatasetId : '2024') as Year;
				
				// Fetch only the GeoJSON we need
				const activeGeo = await fetchGeojson(activeYear);
				
				if (cancelled) return;

				console.log('Loaded geojson for', activeDatasetId, ':', activeGeo.features.length);

				setGeojson(activeGeo);

				// Get active dataset's ward data and results
				const activeDataset = datasetsByYear[activeYear];
				const activeResults = activeDataset?.wardResults || {};
				const activeData = activeDataset?.wardData || {};

				if (cancelled) return;

				// Build ward name to population code mapping
				const populationCodes = Object.keys(populationDatasets[0]?.populationData || {});
				const wardNameMap = buildWardNameToPopCodeMap(activeGeo, populationCodes);

				if (cancelled) return;

				setWardNameToPopCode(wardNameMap);
				setWardData(activeData);
				setWardResults(activeResults);
				setIsLoading(false);
			} catch (err) {
				console.error('Error loading ward datasets:', err);
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}

		loadAll();

		return () => {
			cancelled = true;
		};
	}, [activeDatasetId, datasetsByYear, populationDatasets]);

	return { geojson, wardData, wardResults, wardNameToPopCode, isLoading };
}