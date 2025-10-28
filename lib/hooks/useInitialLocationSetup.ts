import { RefObject, useEffect, useRef } from 'react';
import type { LocationBounds } from '@lib/types';

interface UseInitialLocationSetupParams {
	geojson: any;
	wardData: any;
	wardResults: any;
	activeDataset: any;
	mapManagerRef: any;
	calculateAllYearsData: (location: LocationBounds) => any;
	initialLocation: LocationBounds;
	setAggregatedChartData: (data: any) => void;
	setSelectedLocation: (loc: string) => void;
	setSelectedWard: (ward: any) => void;
	hasInitialized: RefObject<boolean>; // Add this line
	lastProcessedDatasetId: RefObject<string | null>;
}

export function useInitialLocationSetup({
	geojson,
	wardData,
	wardResults,
	activeDataset,
	mapManagerRef,
	calculateAllYearsData,
	initialLocation,
	setAggregatedChartData,
	setSelectedLocation,
	setSelectedWard,
	hasInitialized,
	lastProcessedDatasetId,
}: UseInitialLocationSetupParams) {
	const isInitializing = useRef(false);

	useEffect(() => {
		if (hasInitialized.current || isInitializing.current) return;
		if (!geojson || !wardData || !mapManagerRef.current || !activeDataset) return;

		isInitializing.current = true;

		const initialize = () => {
			console.log('Initialize location...')
			const stats = mapManagerRef.current!.calculateLocationStats(
				initialLocation,
				geojson,
				wardData,
				activeDataset.id
			);

			const aggregates = calculateAllYearsData(initialLocation);

			mapManagerRef.current!.updateMapForLocation(
				initialLocation,
				geojson,
				wardResults,
				wardData,
				stats,
				activeDataset.partyInfo
			);

			setAggregatedChartData(aggregates);
			setSelectedLocation(initialLocation.name);
			setSelectedWard(null);

			hasInitialized.current = true;
			lastProcessedDatasetId.current = activeDataset.id;
			isInitializing.current = false;
		};

		requestAnimationFrame(initialize);
	}, [
		geojson,
		wardData,
		activeDataset,
		mapManagerRef
	]);
}
