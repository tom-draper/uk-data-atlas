// page.tsx
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

import { useLocalElectionData as useLocalElectionDatasets } from '@/lib/hooks/useLocalElectionData';
import { useGeneralElectionData as useGeneralElectionDatasets } from '@/lib/hooks/useGeneralElectionData';
import { usePopulationData as usePopulationDatasets } from '@lib/hooks/usePopulationData';
import { useMapManager } from '@lib/hooks/useMapManager';
import { useMapInitialization } from '@lib/hooks/useMapboxInitialization';
import { useAggregatedElectionData } from '@lib/hooks/useAggregatedChartData';
import { useInteractionHandlers } from '@/lib/hooks/useInteractionHandlers';
import { useBoundaryData } from '@/lib/hooks/useBoundaryData';
import { useDatasetManager, DATASET_IDS } from '@/lib/hooks/useDatasetManager';

import ControlPanel from '@components/ControlPanel';
import LegendPanel from '@components/LegendPanel';
import ChartPanel from '@components/ChartPanel';
import ErrorDisplay from '@components/ErrorDisplay';
import LoadingDisplay from '@/components/LoadingDisplay';

import { LOCATIONS } from '@lib/data/locations';
import type { WardData } from '@lib/types';
import type { ConstituencyData } from '@/lib/hooks/useGeneralElectionData';

// Constants
const INITIAL_LOCATION = 'Greater Manchester';
const INITIAL_DATASET_ID = '2024';
const MAP_CONFIG = {
	style: 'mapbox://styles/mapbox/light-v11',
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
} as const;

export default function MapsPage() {
	// State
	const [activeDatasetId, setActiveDatasetId] = useState(INITIAL_DATASET_ID);
	const [selectedWardData, setSelectedWard] = useState<WardData | null>(null);
	const [selectedConstituencyData, setSelectedConstituency] = useState<ConstituencyData | null>(null);
	const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

	// Data loading - all hooks now return datasetsById
	const generalElectionData = useGeneralElectionDatasets();
	const localElectionData = useLocalElectionDatasets();
	const populationData = usePopulationDatasets();

	// Consolidated dataset management
	const { activeDataset, boundaryType, targetYear } = useDatasetManager(
		activeDatasetId,
		localElectionData.datasets,
		generalElectionData.datasets,
		populationData.datasets
	);

	// Boundary data
	const { geojson, isLoading: geojsonLoading } = useBoundaryData(boundaryType, targetYear);

	// Map initialization
	const { mapRef: map, handleMapContainer } = useMapInitialization(MAP_CONFIG);

	// Interaction handlers
	const { onWardHover, onConstituencyHover, onLocationChange } = useInteractionHandlers({
		setSelectedWard,
		setSelectedConstituency,
		setSelectedLocation,
	});

	// Map manager
	const mapManagerRef = useMapManager({
		mapRef: map,
		geojson,
		onWardHover: DATASET_IDS.GENERAL_ELECTION.has(activeDatasetId) ? undefined : onWardHover,
		onConstituencyHover: DATASET_IDS.GENERAL_ELECTION.has(activeDatasetId) ? onConstituencyHover : undefined,
		onLocationChange,
	});

	// Aggregated data
	const { aggregatedLocalElectionData, aggregatedGeneralElectionData } = useAggregatedElectionData({
		mapManagerRef,
		geojson,
		localElectionDatasets: localElectionData.datasets,
		generalElectionDatasets: generalElectionData.datasets,
		selectedLocation
	});

	// Refs for tracking state
	const isInitialized = useRef(false);
	const lastRenderedDatasetId = useRef<string | null>(null);

	// Map update function
	const updateMap = useCallback(
		(location: string) => {
			if (!mapManagerRef.current || !geojson || !activeDataset) return;

			if (DATASET_IDS.POPULATION.has(activeDatasetId)) {
				mapManagerRef.current.updateMapForPopulationLocation(
					location, 
					geojson, 
					activeDataset.populationData
				);
			} else if (DATASET_IDS.GENERAL_ELECTION.has(activeDatasetId)) {
				mapManagerRef.current.updateMapForGeneralElectionLocation(
					location,
					geojson,
					activeDataset.constituencyResults,
					activeDataset.constituencyData,
					activeDataset.partyInfo
				);
			} else {
				const stats = mapManagerRef.current.calculateLocalElectionLocationStats(
					location,
					geojson,
					activeDataset.wardData,
					activeDatasetId
				);
				mapManagerRef.current.updateMapForLocalElectionLocation(
					location,
					geojson,
					activeDataset.wardResults,
					activeDataset.wardData,
					stats,
					activeDataset.partyInfo
				);
			}
		},
		[mapManagerRef, geojson, activeDataset, activeDatasetId]
	);

	// Initial setup
	useEffect(() => {
		if (isInitialized.current || !geojson || !activeDataset || geojsonLoading) return;

		isInitialized.current = true;
		setSelectedLocation(INITIAL_LOCATION);
		updateMap(INITIAL_LOCATION);
		lastRenderedDatasetId.current = activeDatasetId;
	}, [geojson, geojsonLoading, activeDataset, activeDatasetId, updateMap]);

	// Dataset change handler
	useEffect(() => {
		if (!isInitialized.current || !geojson || !activeDataset || geojsonLoading) return;
		if (lastRenderedDatasetId.current === activeDatasetId) return;

		const location = LOCATIONS[selectedLocation || ''];
		if (!location) return;

		// Clear opposite selection when switching modes
		if (DATASET_IDS.GENERAL_ELECTION.has(activeDatasetId)) {
			setSelectedWard(null);
		} else {
			setSelectedConstituency(null);
		}

		updateMap(selectedLocation || '');
		lastRenderedDatasetId.current = activeDatasetId;
	}, [geojson, geojsonLoading, activeDataset, activeDatasetId, selectedLocation, updateMap]);

	// Event handlers
	const handleLocationClick = useCallback(
		(location: string) => {
			if (!mapManagerRef.current || !geojson || !activeDataset) return;

			setSelectedLocation(location);

			requestAnimationFrame(() => {
				updateMap(location);
				map.current?.fitBounds(LOCATIONS[location].bounds, {
					padding: MAP_CONFIG.fitBoundsPadding,
					duration: MAP_CONFIG.fitBoundsDuration,
				});
			});
		},
		[geojson, activeDataset, updateMap, map, mapManagerRef]
	);

	const handleDatasetChange = useCallback((id: string) => setActiveDatasetId(id), []);

	// Loading and error states
	const isLoading = localElectionData.loading || generalElectionData.loading || populationData.loading;
	if (isLoading) return <LoadingDisplay />;

	const errorMessage = localElectionData.error || generalElectionData.error || populationData.error;
	if (errorMessage) return <ErrorDisplay message={errorMessage ?? 'Error loading data'} />;

	if (!activeDataset) return <ErrorDisplay message="No datasets loaded" />;

	// Render
	return (
		<div style={{ width: '100%', height: '100vh', position: 'relative' }}>
			<div className="fixed inset-0 z-50 h-full w-full pointer-events-none">
				<div className="absolute left-0 flex h-full">
					<ControlPanel
						selectedLocation={selectedLocation}
						onLocationClick={handleLocationClick}
						population={populationData.datasets['population'].populationData!}
					/>
				</div>

				<div className="absolute right-0 flex h-full">
					<LegendPanel isPopulationMode={DATASET_IDS.POPULATION.has(activeDatasetId)} />
					<ChartPanel
						selectedLocation={selectedLocation}
						selectedWard={selectedWardData}
						selectedConstituency={selectedConstituencyData}
						activeDataset={activeDataset}
						localElectionDatasets={localElectionData.datasets}
						generalElectionDatasets={generalElectionData.datasets}
						populationDatasets={populationData.datasets}
						onDatasetChange={handleDatasetChange}
						aggregatedLocalElectionData={aggregatedLocalElectionData}
						aggregatedGeneralElectionData={aggregatedGeneralElectionData}
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