// page.tsx
'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

import { useElectionData } from '@lib/hooks/useElectionData';
import { usePopulationData } from '@lib/hooks/usePopulationData';
import { useMapManager } from '@lib/hooks/useMapManager';
import { useMapInitialization } from '@lib/hooks/useMapboxInitialization';
import { useAggregatedChartData } from '@lib/hooks/useAggregatedChartData';
import { useWardInteractionHandlers } from '@lib/hooks/useWardInteractionHandlers';
import { useWardGeoJSON } from '@lib/hooks/useWardGeoJSON';

import ControlPanel from '@components/ControlPanel';
import LegendPanel from '@components/LegendPanel';
import ChartPanel from '@components/ChartPanel';
import ErrorDisplay from '@components/ErrorDisplay';

import { LOCATIONS } from '@lib/data/locations';
import type { ChartData, LocationBounds, WardData } from '@lib/types';

interface AggregatedChartData {
	data2024: ChartData | null;
	data2023: ChartData | null;
	data2022: ChartData | null;
	data2021: ChartData | null;
}

const INITIAL_LOCATION = LOCATIONS[0];
const INITIAL_DATASET_ID = '2024';
const MAP_CONFIG = {
	style: 'mapbox://styles/mapbox/light-v11',
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
};

export default function MapsPage() {
	// State
	const [activeDatasetId, setActiveDatasetId] = useState<string>(INITIAL_DATASET_ID);
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

	const { geojson, isLoading: geojsonLoading } = useWardGeoJSON(activeDataset?.year || null);

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
	}, [geojson, activeDataset, activeDatasetId, calculateAllYearsData]);

	const isInitialized = useRef(false);
	const lastRenderedDatasetId = useRef<string | null>(null);

	// Initial map setup effect
	useEffect(() => {
		if (isInitialized.current) return;
		if (!geojson || !activeDataset || geojsonLoading) return;

		isInitialized.current = true;
		setSelectedLocation(INITIAL_LOCATION.name);
		updateMapForLocation(INITIAL_LOCATION, false);

		lastRenderedDatasetId.current = activeDatasetId;
	}, [geojson, geojsonLoading, activeDataset, activeDatasetId, updateMapForLocation]);

	const getGeojsonYear = (geojson: any): number | null => {
		const props = geojson.features[0]?.properties;
		if (!props) return null;

		if (props.WD24CD) return 2024;
		if (props.WD23CD) return 2023;
		if (props.WD22CD) return 2022;
		if (props.WD21CD) return 2021;

		return null;
	};

	// Update map when dataset changes - ONLY if already initialized
	useEffect(() => {
		if (!isInitialized.current) return;
		if (!geojson || !activeDataset || geojsonLoading) return;

		// Avoid redundant updates
		if (lastRenderedDatasetId.current === activeDatasetId) {
			return;
		}

		// Wait until geojson has been loaded and matches the active dataset year
		const geojsonYear = getGeojsonYear(geojson);
		if (geojsonYear && geojsonYear !== activeDataset.year) {
			return;
		}

		const location = LOCATIONS.find(loc => loc.name === selectedLocation);
		if (!location) return;

		updateMapForLocation(location, false);

		lastRenderedDatasetId.current = activeDatasetId;
	}, [geojson, geojsonLoading, activeDataset, activeDatasetId, selectedLocation, updateMapForLocation]);

	const handleLocationClick = useCallback((location: LocationBounds) => {
		if (!mapManagerRef.current || !geojson || !activeDataset) return;

		setSelectedLocation(location.name);

		// Batch the heavy work
		requestAnimationFrame(() => {
			updateMapForLocation(location, false);

			map.current?.fitBounds(location.bounds, {
				padding: MAP_CONFIG.fitBoundsPadding,
				duration: MAP_CONFIG.fitBoundsDuration,
			});
		});
	}, [geojson, activeDataset, updateMapForLocation, map]);

	const handleDatasetChange = useCallback((id: string) => {
		setActiveDatasetId(id);
	}, []);

	const isLoading = electionDataLoading || populationDataLoading;

	if (isLoading) {
		return (
			<div className="absolute inset-0 flex items-center justify-center bg-white z-10">
				<div className="text-sm text-gray-500">
					<img src="uk.png" alt="" className="h-[200px] mb-10 mr-4" />
				</div>
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
			<div className="fixed inset-0 z-50 h-full w-full pointer-events-none">
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