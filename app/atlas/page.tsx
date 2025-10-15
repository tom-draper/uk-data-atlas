// page.tsx - Optimized version
'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

import { useElectionData } from '@/lib/hooks/useElectionData';
import { usePopulationData } from '@/lib/hooks/usePopulationData';
import { useWardDatasets } from '@/lib/hooks/useWardDatasets';
import { useMapManager } from '@/lib/hooks/useMapManager';
import { useMapInitialization } from '@/lib/hooks/useMapboxInitialization';
import { useAggregatedChartData } from '@/lib/hooks/useAggregatedChartData';
import { useInitialLocationSetup } from '@/lib/hooks/useInitialLocationSetup';

import ControlPanel from '@/components/ControlPanel';
import LegendPanel from '@/components/LegendPanel';
import ChartPanel from '@/components/ChartPanel';
import ErrorDisplay from '@/components/ErrorDisplay';

import { LOCATIONS } from '@/lib/data/locations';
import type { ChartData, LocationBounds, WardData } from '@/lib/types';
import { useWardInteractionHandlers } from '@/lib/hooks/useWardInteractionHandlers';

interface AggregatedChartData {
	data2024: ChartData | null;
	data2023: ChartData | null;
	data2022: ChartData | null;
	data2021: ChartData | null;
}

const INITIAL_LOCATION = LOCATIONS[0];
const MAP_CONFIG = {
	style: 'mapbox://styles/mapbox/light-v11',
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
};

export default function MapsPage() {
	// Refs
	const hasInitialized = useRef(false);

	// Data hooks
	const { datasets: electionDatasets, loading: electionDataLoading, error: electionDataError } = useElectionData();
	const { datasets: populationDatasets, loading: populationDataLoading, error: populationDataError } = usePopulationData();

	// Map
	const { mapRef: map, handleMapContainer } = useMapInitialization(MAP_CONFIG);

	// State
	const [activeDatasetId, setActiveDatasetId] = useState<string>('2024');
	const [selectedWard, setSelectedWard] = useState<WardData | null>(null);
	const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
	const [chartTitle, setChartTitle] = useState<string>('Greater Manchester');
	const [aggregatedChartData, setAggregatedChartData] = useState<AggregatedChartData>({
		data2024: null,
		data2023: null,
		data2022: null,
		data2021: null,
	});

	// Computed values - memoize to prevent unnecessary recalculations
	const allDatasets = useMemo(
		() => [...electionDatasets, ...populationDatasets],
		[electionDatasets, populationDatasets]
	);

	const activeDataset = useMemo(
		() => allDatasets.find(d => d.id === activeDatasetId) || allDatasets[0],
		[allDatasets, activeDatasetId]
	);

	const { geojson: activeGeoJSON, wardData, wardResults, wardNameToPopCode, isLoading: wardDataLoading } =
		useWardDatasets(allDatasets, activeDatasetId, populationDatasets);

	// Memoize this to prevent recalculation on every render
	const allYearsWardData = useMemo(() => ({
		data2024: electionDatasets.find(d => d.id === '2024')?.wardData || {},
		data2023: electionDatasets.find(d => d.id === '2023')?.wardData || {},
		data2022: electionDatasets.find(d => d.id === '2022')?.wardData || {},
		data2021: electionDatasets.find(d => d.id === '2021')?.wardData || {},
	}), [electionDatasets]);

	// Memoize population data to prevent unnecessary re-renders
	const populationData = useMemo(() => populationDatasets[0]?.populationData ?? {}, [populationDatasets]);

	const {
		onWardHover,
		onLocationChange,
	} = useWardInteractionHandlers({
		setChartTitle,
		setSelectedWard,
		setSelectedLocation,
	});

	// Map manager setup
	const mapManagerRef = useMapManager({
		mapRef: map,
		geojson: activeGeoJSON,
		onWardHover,
		onLocationChange,
	});

	const { calculateAllYearsData } = useAggregatedChartData({
		mapManagerRef,
		activeGeoJSON,
		electionDatasets,
	});

	// Initialise location - run once
	useInitialLocationSetup({
		activeGeoJSON,
		wardData,
		wardResults,
		activeDataset,
		mapManagerRef,
		calculateAllYearsData,
		initialLocation: INITIAL_LOCATION,
		setAggregatedChartData,
		setSelectedLocation,
		setChartTitle,
		setSelectedWard,
	});

	// Update map when dataset changes - ONLY if already initialized
	useEffect(() => {
		console.log('Update map when dataset changes')
		if (!hasInitialized.current) return;
		if (!activeGeoJSON || !wardData || !mapManagerRef.current || !activeDataset || !selectedLocation) return;

		const currentLocation = LOCATIONS.find(loc => loc.name === selectedLocation);
		if (!currentLocation) return;

		const stats = mapManagerRef.current.calculateLocationStats(
			currentLocation,
			activeGeoJSON,
			wardData
		);

		mapManagerRef.current.updateMapForLocation(
			currentLocation,
			activeGeoJSON,
			wardResults,
			wardData,
			stats,
			activeDataset.partyInfo
		);
	}, [activeDatasetId, activeGeoJSON, wardData, wardResults, activeDataset, selectedLocation, mapManagerRef]);

	// Handlers - memoized with proper dependencies
	const handleLocationClick = useCallback((location: LocationBounds) => {
		console.log('Location click!')
		if (!mapManagerRef.current || !activeGeoJSON || !activeDataset) return;

		setSelectedLocation(location.name);

		const stats = mapManagerRef.current.calculateLocationStats(
			location,
			activeGeoJSON,
			activeDataset.wardData
		);

		const newAggregates = calculateAllYearsData(location);

		// Batch updates
		setAggregatedChartData(newAggregates);

		mapManagerRef.current.updateMapForLocation(
			location,
			activeGeoJSON,
			activeDataset.wardResults,
			activeDataset.wardData,
			stats,
			activeDataset.partyInfo
		);

		map.current?.fitBounds(location.bounds, {
			padding: MAP_CONFIG.fitBoundsPadding,
			duration: MAP_CONFIG.fitBoundsDuration,
		});
	}, [mapManagerRef, activeGeoJSON, activeDataset, calculateAllYearsData]);

	const handleDatasetChange = useCallback((id: string) => {
		console.log('Handling dataset changing')
		setActiveDatasetId(id);
	}, []);

	const isLoading = electionDataLoading || populationDataLoading;

	if (isLoading) {
		return (
			<div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
				<div className="text-sm">Loading map...</div>
			</div>
		);
	}

	// Error states
	if (electionDataError || populationDataError) {
		return <ErrorDisplay message={(electionDataError || populationDataError) ?? 'Error loading data'} />;
	}

	if (!activeDataset) {
		return <ErrorDisplay message="No datasets loaded" />;
	}

	return (
		<div style={{ width: '100%', height: '100vh', position: 'relative' }}>
			<div className="fixed inset-0 z-[50] h-full w-full pointer-events-none">
				<div className="absolute left-0 flex h-full">
					<ControlPanel
						selectedLocation={selectedLocation}
						onLocationClick={handleLocationClick}
						population={populationData}
					/>
				</div>

				<div className="absolute right-0 flex h-full">
					<LegendPanel />
					<ChartPanel
						title={chartTitle}
						selectedWard={selectedWard}
						wardData={allYearsWardData}
						population={populationData}
						activeDataset={activeDataset}
						availableDatasets={allDatasets}
						onDatasetChange={handleDatasetChange}
						aggregatedData={aggregatedChartData}
						wardCodeMap={wardNameToPopCode}
					/>
				</div>
			</div>

			<div
				ref={handleMapContainer}
				style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
			/>
		</div>
	);
}