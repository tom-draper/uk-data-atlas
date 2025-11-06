// page.tsx
'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { ConstituencyData, LocalElectionWardData } from '@lib/types';
import { useWardCodeMapper } from '@/lib/hooks/useWardCodeMapper';

// Constants
const INITIAL_STATE = {
  location: 'Greater Manchester',
  datasetId: '2024',
} as const;
const MAP_CONFIG = {
	style: 'mapbox://styles/mapbox/light-v11',
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
} as const;

export default function MapsPage() {
	// State
	const [activeDatasetId, setActiveDatasetId] = useState<string>(INITIAL_STATE.datasetId);
	const [selectedWardData, setSelectedWard] = useState<LocalElectionWardData | null>(null);
	const [selectedConstituencyData, setSelectedConstituency] = useState<ConstituencyData | null>(null);
	const [selectedLocation, setSelectedLocation] = useState<string>(INITIAL_STATE.location);

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
	const { boundaryData, isLoading: geojsonLoading } = useBoundaryData(selectedLocation);

	const wardMapper = useWardCodeMapper(boundaryData);

	const geojson = useMemo(() => {
		if (boundaryType === 'ward' && targetYear) {
			return boundaryData.ward[targetYear];
		} else if (boundaryType === 'constituency') {
			return boundaryData.constituency[2024];
		}
		return null;
	}, [boundaryData, boundaryType, targetYear]);

	// Map initialization
	const { mapRef: map, handleMapContainer } = useMapInitialization(MAP_CONFIG);

	// Interaction handlers
	const { onWardHover, onConstituencyHover, onLocationChange } = useInteractionHandlers({
		setSelectedWard,
		setSelectedConstituency,
		setSelectedLocation,
	});

	// Map manager - simplified callbacks
	const mapManager = useMapManager({
		mapRef: map,
		geojson,
		onWardHover: activeDataset?.type === 'local-election' || activeDataset?.type === 'population' ? onWardHover : undefined,
		onConstituencyHover: activeDataset?.type === 'general-election' ? onConstituencyHover : undefined,
		onLocationChange,
	});

	// Aggregated data (this might now be redundant for some use cases)
	const { aggregatedLocalElectionData, aggregatedGeneralElectionData } = useAggregatedElectionData({
		mapManager,
		boundaryData,
		localElectionDatasets: localElectionData.datasets,
		generalElectionDatasets: generalElectionData.datasets,
	});

	// Dataset change handler
	useEffect(() => {
		if (!geojson || geojsonLoading || !activeDataset || !mapManager) return;

		switch (activeDataset.type) {
			case 'population':
				mapManager.updateMapForPopulation(
					geojson,
					activeDataset.populationData,
				);
				break;
			case 'general-election':
				mapManager.updateMapForGeneralElection(
					geojson,
					activeDataset.constituencyResults,
					activeDataset.constituencyData,
					activeDataset.partyInfo,
				);
				break;
			case 'local-election':
				mapManager.updateMapForLocalElection(
					geojson,
					activeDataset.wardResults,
					activeDataset.wardData,
					activeDataset.partyInfo,
				);
				break;
		}
	}, [geojson, geojsonLoading, activeDataset, mapManager]);

	// Location click handler
	const handleLocationClick = useCallback((location: string) => {
		if (!mapManager) return;
		const locationData = LOCATIONS[location];
		if (!locationData) return;

		setSelectedLocation(location);

		requestAnimationFrame(() => {
			map.current?.fitBounds(locationData.bounds, {
				padding: MAP_CONFIG.fitBoundsPadding,
				duration: MAP_CONFIG.fitBoundsDuration,
			});
		});
	}, [map, mapManager]);

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