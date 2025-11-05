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

	// Data loading
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

	// Map manager - simplified callbacks
	const mapManagerRef = useMapManager({
		mapRef: map,
		geojson,
		// Only provide the callback that's relevant for the current mode
		onWardHover: DATASET_IDS.GENERAL_ELECTION.has(activeDatasetId) ? undefined : onWardHover,
		onConstituencyHover: DATASET_IDS.GENERAL_ELECTION.has(activeDatasetId) ? onConstituencyHover : undefined,
		onLocationChange,
	});

	// Aggregated data (this might now be redundant for some use cases)
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

	// Simplified map update function - stats are now calculated internally
	const updateMap = useCallback(
		(location: string) => {
			if (!mapManagerRef.current || !geojson || !activeDataset) return;

			const locationData = LOCATIONS[location];
			if (!locationData) return;

			if (DATASET_IDS.POPULATION.has(activeDatasetId)) {
				// Population mode
				mapManagerRef.current.updateMapForPopulation(
					location, 
					geojson, 
					activeDataset.populationData
				);
			} else if (DATASET_IDS.GENERAL_ELECTION.has(activeDatasetId)) {
				// General election mode
				mapManagerRef.current.updateMapForGeneralElection(
					location,
					geojson,
					activeDataset.constituencyResults,
					activeDataset.constituencyData,
					activeDataset.partyInfo,
					activeDatasetId // Pass year for caching
				);
			} else {
				// Local election mode
				mapManagerRef.current.updateMapForLocalElection(
					location,
					geojson,
					activeDataset.wardResults,
					activeDataset.wardData,
					activeDataset.partyInfo,
					activeDatasetId // Pass year for caching
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

	// Location click handler
	const handleLocationClick = useCallback(
		(location: string) => {
			if (!mapManagerRef.current || !geojson || !activeDataset) return;

			const locationData = LOCATIONS[location];
			if (!locationData) return;

			setSelectedLocation(location);

			requestAnimationFrame(() => {
				updateMap(location);
				map.current?.fitBounds(locationData.bounds, {
					padding: MAP_CONFIG.fitBoundsPadding,
					duration: MAP_CONFIG.fitBoundsDuration,
				});
			});
		},
		[geojson, activeDataset, updateMap, map, mapManagerRef]
	);

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
						setActiveDatasetId={setActiveDatasetId}
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