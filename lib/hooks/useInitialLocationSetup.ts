import { useEffect, useRef } from 'react';
import type { LocationBounds } from '@/lib/types';

interface UseInitialLocationSetupParams {
	activeGeoJSON: any;
	wardData: any;
	wardResults: any;
	activeDataset: any;
	mapManagerRef: any;
	calculateAllYearsData: (location: LocationBounds) => any;
	initialLocation: LocationBounds;
	setAggregatedChartData: (data: any) => void;
	setSelectedLocation: (loc: string) => void;
	setChartTitle: (title: string) => void;
	setSelectedWard: (ward: any) => void;
}

export function useInitialLocationSetup({
	activeGeoJSON,
	wardData,
	wardResults,
	activeDataset,
	mapManagerRef,
	calculateAllYearsData,
	initialLocation,
	setAggregatedChartData,
	setSelectedLocation,
	setChartTitle,
	setSelectedWard,
}: UseInitialLocationSetupParams) {
	const hasInitialized = useRef(false);
	const isInitializing = useRef(false);

	useEffect(() => {
		console.log('Initialising location')
		if (hasInitialized.current || isInitializing.current) return;
		if (!activeGeoJSON || !wardData || !mapManagerRef.current || !activeDataset) return;

		isInitializing.current = true;

		const initialize = () => {
			const stats = mapManagerRef.current!.calculateLocationStats(
				initialLocation,
				activeGeoJSON,
				wardData
			);

			const aggregates = calculateAllYearsData(initialLocation);

			mapManagerRef.current!.updateMapForLocation(
				initialLocation,
				activeGeoJSON,
				wardResults,
				wardData,
				stats,
				activeDataset.partyInfo
			);

			setAggregatedChartData(aggregates);
			setSelectedLocation(initialLocation.name);
			setChartTitle(initialLocation.name);
			setSelectedWard(null);

			hasInitialized.current = true;
			isInitializing.current = false;
		};

		requestAnimationFrame(initialize);
	}, [
		activeGeoJSON,
		wardData,
		wardResults,
		activeDataset,
		mapManagerRef,
		calculateAllYearsData,
		initialLocation,
		setAggregatedChartData,
		setSelectedLocation,
		setChartTitle,
		setSelectedWard,
	]);
}
