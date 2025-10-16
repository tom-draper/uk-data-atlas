import { useCallback, useRef } from 'react';
import type { ChartData, LocationBounds } from '@/lib/types';

interface AggregatedChartData {
	data2024: ChartData | null;
	data2023: ChartData | null;
	data2022: ChartData | null;
	data2021: ChartData | null;
}

interface UseAggregatedChartDataParams {
	mapManagerRef: any;
	geojson: any;
	electionDatasets: any[];
}

export function useAggregatedChartData({ mapManagerRef, geojson, electionDatasets }: UseAggregatedChartDataParams) {
	const lastCalcRef = useRef<{ locName: string, data: AggregatedChartData } | null>(null);
	const YEARS = ['2024', '2023', '2022', '2021'] as const;

	const calculateAllYearsData = useCallback(
		(location: LocationBounds): AggregatedChartData => {
			if (lastCalcRef.current?.locName === location.name) {
				return lastCalcRef.current.data;
			}

			if (!mapManagerRef.current || !geojson) {
				return { data2024: null, data2023: null, data2022: null, data2021: null };
			}

			console.log('Calculating aggregated chart data! (expensive)');
			const result: any = {};
			for (const year of YEARS) {
				const dataset = electionDatasets.find(d => d.id === year);
				result[`data${year}`] = dataset?.wardData
					? mapManagerRef.current.calculateLocationStats(location, geojson, dataset.wardData, year)
					: null;
			}

			const output = result as AggregatedChartData;
			lastCalcRef.current = { locName: location.name, data: output };
			return output;
		},
		[mapManagerRef, geojson, electionDatasets]
	);

	return { calculateAllYearsData };
}