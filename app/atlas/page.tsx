'use client';
import { useState, useMemo } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

import { DataProvider } from '@lib/contexts/dataContext';
import { useLocalElectionData } from '@lib/hooks/useLocalElectionData';
import { useGeneralElectionData } from '@lib/hooks/useGeneralElectionData';
import { usePopulationData } from '@lib/hooks/usePopulationData';
import { useHousePriceData } from '@lib/hooks/useHousePriceData';
import MapInterface from '@components/MapInterface';
import ErrorDisplay from '@/components/displays/ErrorDisplay';
import LoadingDisplay from '@/components/displays/LoadingDisplay';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function MapsPage() {
	const [activeDatasetId, setActiveDatasetId] = useState('local-election-2024');
	const [selectedLocation, setSelectedLocation] = useState('Greater Manchester');

	// Load all data
	const localElection = useLocalElectionData();
	const generalElection = useGeneralElectionData();
	const population = usePopulationData();
	const housePrice = useHousePriceData();

	// Combine datasets
	const datasets = useMemo(() => ({
		'local-election': localElection.datasets,
		'general-election': generalElection.datasets,
		'population': population.datasets,
		'house-price': housePrice.datasets,
	}), [
		localElection.datasets,
		generalElection.datasets,
		population.datasets,
		housePrice.datasets,
	]);

	// Loading and error states
	const loading = 
		localElection.loading ||
		generalElection.loading ||
		population.loading ||
		housePrice.loading;

	const errors = useMemo(() => {
		const errs: string[] = [];
		if (localElection.error) errs.push(localElection.error);
		if (generalElection.error) errs.push(generalElection.error);
		if (population.error) errs.push(population.error);
		if (housePrice.error) errs.push(housePrice.error);
		return errs;
	}, [localElection.error, generalElection.error, population.error, housePrice.error]);

	// Error handling
	if (loading) return <LoadingDisplay />;
	if (errors.length > 0) return <ErrorDisplay message={errors[0]} />;

	return (
		<ErrorBoundary>
			<DataProvider
				datasets={datasets}
				activeDatasetId={activeDatasetId}
				selectedLocation={selectedLocation}
				onDatasetChange={setActiveDatasetId}
				onLocationChange={setSelectedLocation}
			>
				<MapInterface />
			</DataProvider>
		</ErrorBoundary>
	);
}