// page.tsx
'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

import { useElectionData } from '@/lib/hooks/useElectionData';
import { usePopulationData } from '@/lib/hooks/usePopulationData';
import { useMapManager } from '@/lib/hooks/useMapManager';
import { useMapInitialization } from '@/lib/hooks/useMapboxInitialization';
import { useAggregatedChartData } from '@/lib/hooks/useAggregatedChartData';
import { useWardInteractionHandlers } from '@/lib/hooks/useWardInteractionHandlers';
import { useWardGeoJSON } from '@/lib/hooks/useWardGeoJSON';

import ControlPanel from '@/components/ControlPanel';
import LegendPanel from '@/components/LegendPanel';
import ChartPanel from '@/components/ChartPanel';
import ErrorDisplay from '@/components/ErrorDisplay';

import { LOCATIONS } from '@/lib/data/locations';
import type { ChartData, LocationBounds, WardData } from '@/lib/types';

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
	// State
	const [activeDatasetId, setActiveDatasetId] = useState<string>('2024');
	const [selectedWardData, setSelectedWard] = useState<WardData | null>(null);
	const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
	const [aggregatedChartData, setAggregatedChartData] = useState<AggregatedChartData>({
		data2024: null,
		data2023: null,
		data2022: null,
		data2021: null,
	});

	// Data loading
	const { datasets: electionDatasets, loading: electionDataLoading, error: electionDataError } = useElectionData();
	const { datasets: populationDatasets, loading: populationDataLoading, error: populationDataError } = usePopulationData();

	const activeDataset = useMemo(() => {
		return electionDatasets.find(d => d.id === activeDatasetId) || electionDatasets[0];
	}, [electionDatasets, activeDatasetId]);

	const populationData = useMemo(() => {
		return populationDatasets[0]?.populationData || {};
	}, [populationDatasets]);

	const { geojson, isLoading: geojsonLoading } = useWardGeoJSON(
		activeDataset?.year || '2024'
	);

	// Map setup
	const { mapRef: map, handleMapContainer } = useMapInitialization(MAP_CONFIG);

	const { onWardHover, onLocationChange } = useWardInteractionHandlers({
		setSelectedWard,
		selectedLocation,
		setSelectedLocation,
	});

	const mapManagerRef = useMapManager({
		mapRef: map,
		geojson,
		onWardHover,
		onLocationChange,
	});

	const { calculateAllYearsData } = useAggregatedChartData({
		mapManagerRef,
		geojson,
		electionDatasets,
	});

	// Location update logic
	const updateMapForLocation = useCallback((location: LocationBounds, skipAggregates = false) => {
		if (!mapManagerRef.current || !geojson || !activeDataset) return;

		console.log('Updating map for location');

		// Calculate stats using the dataset's data directly
		const stats = mapManagerRef.current.calculateLocationStats(
			location,
			geojson,
			activeDataset.wardData, // Use directly from dataset
			activeDatasetId
		);

		// Update aggregated data if needed
		if (!skipAggregates) {
			const newAggregates = calculateAllYearsData(location);
			setAggregatedChartData(newAggregates);
		}

		// Update the map visualization
		mapManagerRef.current.updateMapForLocation(
			location,
			geojson,
			activeDataset.wardResults, // Use directly from dataset
			activeDataset.wardData,
			stats,
			activeDataset.partyInfo
		);
	}, [mapManagerRef, geojson, activeDataset, activeDatasetId, calculateAllYearsData]);

	const hasInitialized = useRef(false);

	useEffect(() => {
		if (hasInitialized.current) return;
		if (!geojson || !activeDataset || geojsonLoading) return;

		console.log('Initial setup');
		hasInitialized.current = true;
		setSelectedLocation(INITIAL_LOCATION.name);
		updateMapForLocation(INITIAL_LOCATION, false);
	}, [geojson, activeDataset, geojsonLoading, updateMapForLocation]);

	const previousDatasetId = useRef<string | null>(null);

	// Update map when dataset changes - ONLY if already initialized
	useEffect(() => {
		if (!hasInitialized.current) return;
		if (!selectedLocation || !geojson || !activeDataset || geojsonLoading) return;

		if (previousDatasetId.current === activeDatasetId) {
			console.log('Skipping update map -> previousDatasetId.current === activeDatasetId')
			return;
		}
		previousDatasetId.current = activeDatasetId;

		const location = LOCATIONS.find(loc => loc.name === selectedLocation);
		if (!location) return;

		console.log('Dataset changed, updating map');
		updateMapForLocation(location, false);
	}, [geojson, activeDataset, selectedLocation, geojsonLoading, previousDatasetId, updateMapForLocation]);

	const handleLocationClick = useCallback((location: LocationBounds) => {
		if (!mapManagerRef.current || !geojson || !activeDataset) return;

		console.log('Location clicked:', location.name);
		setSelectedLocation(location.name);

		// Batch the heavy work
		requestAnimationFrame(() => {
			updateMapForLocation(location, false);

			map.current?.fitBounds(location.bounds, {
				padding: MAP_CONFIG.fitBoundsPadding,
				duration: MAP_CONFIG.fitBoundsDuration,
			});
		});
	}, [mapManagerRef, geojson, activeDataset, updateMapForLocation, map]);

	const handleDatasetChange = useCallback((id: string) => {
		console.log('Dataset clicked!');
		setActiveDatasetId(id);
	}, []);

	const isLoading = electionDataLoading || populationDataLoading;

	if (isLoading) {
		return (
			<div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
				<div className="text-sm text-gray-500">Loading map...</div>
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
						selectedLocation={selectedLocation}
						selectedWard={selectedWardData}
						population={populationData}
						activeDataset={activeDataset}
						availableDatasets={electionDatasets}
						onDatasetChange={handleDatasetChange}
						aggregatedData={aggregatedChartData}
						wardCodeMap={{}}
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