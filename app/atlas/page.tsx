// page.tsx
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

import { useLocalElectionData } from '@/lib/hooks/useLocalElectionData';
import { useGeneralElectionData } from '@/lib/hooks/useGeneralElectionData';
import { usePopulationData } from '@lib/hooks/usePopulationData';
import { useMapManager } from '@lib/hooks/useMapManager';
import { useMapInitialization } from '@lib/hooks/useMapboxInitialization';
import { useAggregatedElectionData } from '@lib/hooks/useAggregatedChartData';
import { useInteractionHandlers } from '@/lib/hooks/useInteractionHandlers';
import { useBoundaryData } from '@/lib/hooks/useBoundaryData';

import ControlPanel from '@components/ControlPanel';
import LegendPanel from '@components/LegendPanel';
import ChartPanel from '@components/ChartPanel';
import ErrorDisplay from '@components/ErrorDisplay';

import { LOCATIONS } from '@lib/data/locations';
import type { LocationBounds, WardData } from '@lib/types';
import type { ConstituencyData } from '@/lib/hooks/useGeneralElectionData';
import LoadingDisplay from '@/components/LoadingDisplay';

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
	const [selectedConstituencyData, setSelectedConstituency] = useState<ConstituencyData | null>(null);
	const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

	// Data loading
	const { datasets: generalElectionDatasets, loading: generalElectionDataLoading, error: generalElectionDataError } = useGeneralElectionData();
	const { datasets: localElectionDatasets, loading: localElectionDataLoading, error: localElectionDataError } = useLocalElectionData();
	const { datasets: populationDatasets, loading: populationDataLoading, error: populationDataError } = usePopulationData();

	// Determine mode
	const isPopulationMode = activeDatasetId === 'population';
	const isGeneralElectionMode = activeDatasetId === 'general-2024';

	// Get active dataset
	const activeDataset = useMemo(() => {
		if (isPopulationMode) {
			return populationDatasets[0];
		}
		if (isGeneralElectionMode) {
			return generalElectionDatasets.find(d => d.id === activeDatasetId);
		}
		return localElectionDatasets.find(d => d.id === activeDatasetId) || localElectionDatasets[0];
	}, [localElectionDatasets, generalElectionDatasets, populationDatasets, activeDatasetId, isPopulationMode, isGeneralElectionMode]);

	const populationData = useMemo(() => {
		return populationDatasets[0]?.populationData || {};
	}, [populationDatasets]);

	// Load appropriate boundaries based on mode
	const boundaryType = isGeneralElectionMode ? 'constituency' : 'ward';
	const targetYear = isPopulationMode ? 2021 : (activeDataset?.year || null);
	const { geojson, isLoading: geojsonLoading } = useBoundaryData(boundaryType, targetYear);

	// Map setup
	const { mapRef: map, handleMapContainer } = useMapInitialization(MAP_CONFIG);

	// Interaction handlers - need to handle both ward and constituency hovers
	const { onWardHover, onConstituencyHover, onLocationChange } = useInteractionHandlers({
		setSelectedWard,
		setSelectedConstituency,
		setSelectedLocation,
	});

	const mapManagerRef = useMapManager({
		mapRef: map,
		geojson,
		onWardHover: isGeneralElectionMode ? undefined : onWardHover,
		onConstituencyHover: isGeneralElectionMode ? onConstituencyHover : undefined,
		onLocationChange,
	});

	const { aggregatedLocalElectionData, aggregatedGeneralElectionData } = useAggregatedElectionData({
		mapManagerRef,
		geojson,
		localElectionDatasets,
		generalElectionDatasets,
		selectedLocation,
		isGeneralElectionMode,
	});

	// Location update logic
	const updateMapForLocation = useCallback((location: LocationBounds, skipAggregates = false) => {
		if (!mapManagerRef.current || !geojson || !activeDataset) return;

		if (isPopulationMode) {
			// Population mode: render age heatmap
			mapManagerRef.current.updateMapForPopulation(
				location,
				geojson,
				populationData
			);
		} else if (isGeneralElectionMode) {
			// General election mode: render constituency colors
			const generalDataset = activeDataset as any; // Cast to general election dataset type
			mapManagerRef.current.updateMapForConstituencies(
				location,
				geojson,
				generalDataset.constituencyResults,
				generalDataset.constituencyData,
				generalDataset.partyInfo
			);
		} else {
			// Local election mode: render ward colors
			const stats = mapManagerRef.current.calculateLocationStats(
				location,
				geojson,
				activeDataset.wardData,
				activeDatasetId
			);

			// Update the map visualization
			mapManagerRef.current.updateMapForLocation(
				location,
				geojson,
				activeDataset.wardResults,
				activeDataset.wardData,
				stats,
				activeDataset.partyInfo
			);
		}
	}, [geojson, activeDataset, activeDatasetId, isPopulationMode, isGeneralElectionMode, populationData]);

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

		// Ward boundaries
		if (props.WD24CD) return 2024;
		if (props.WD23CD) return 2023;
		if (props.WD22CD) return 2022;
		if (props.WD21CD) return 2021;

		// Constituency boundaries
		if (props.PCON24CD) return 2024;

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

		// Wait until geojson has been loaded and matches the target year
		const geojsonYear = getGeojsonYear(geojson);
		const expectedYear = isPopulationMode ? 2021 : activeDataset.year;
		if (geojsonYear && geojsonYear !== expectedYear) {
			return;
		}

		const location = LOCATIONS.find(loc => loc.name === selectedLocation);
		if (!location) return;

		// Clear the opposite selection when switching modes
		if (isGeneralElectionMode) {
			setSelectedWard(null);
		} else {
			setSelectedConstituency(null);
		}

		updateMapForLocation(location, false);

		lastRenderedDatasetId.current = activeDatasetId;
	}, [geojson, geojsonLoading, activeDataset, activeDatasetId, selectedLocation, updateMapForLocation, isPopulationMode, isGeneralElectionMode]);

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
		console.log('Changing dataset to', id);
		setActiveDatasetId(id);
	}, []);

	const isLoading = localElectionDataLoading || generalElectionDataLoading || populationDataLoading;
	if (isLoading) return <LoadingDisplay />;

	const errorMessage = localElectionDataError || generalElectionDataError || populationDataError;
	if (errorMessage) return <ErrorDisplay message={errorMessage ?? 'Error loading data'} />;

	if (!activeDataset) return <ErrorDisplay message="No datasets loaded" />;

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
					<LegendPanel isPopulationMode={isPopulationMode} />
					<ChartPanel
						selectedLocation={selectedLocation}
						selectedWard={selectedWardData}
						selectedConstituency={selectedConstituencyData}
						population={populationData}
						activeDataset={activeDataset}
						localElectionDatasets={localElectionDatasets}
						generalElectionDatasets={generalElectionDatasets}
						onDatasetChange={handleDatasetChange}
						aggregatedLocalElectionData={aggregatedLocalElectionData}
						aggregatedGeneralElectionData={aggregatedGeneralElectionData}
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