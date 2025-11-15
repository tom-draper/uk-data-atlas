// page.tsx
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

import { useLocalElectionData as useLocalElectionDatasets } from '@/lib/hooks/useLocalElectionData';
import { useGeneralElectionData as useGeneralElectionDatasets } from '@/lib/hooks/useGeneralElectionData';
import { usePopulationData as usePopulationDatasets } from '@lib/hooks/usePopulationData';
import { useMapManager } from '@lib/hooks/useMapManager';
import { useMapInitialization } from '@lib/hooks/useMapboxInitialization';
import { useAggregatedElectionData } from '@lib/hooks/useAggregatedChartData';
import { useInteractionHandlers } from '@/lib/hooks/useInteractionHandlers';
import { useBoundaryData } from '@/lib/hooks/useBoundaryData';
import { useDatasetManager } from '@/lib/hooks/useDatasetManager';
import { useCodeMapper } from '@/lib/hooks/useCodeMapper';
import { useMapOptions } from '@/lib/hooks/useMapOptions';

import ControlPanel from '@components/ControlPanel';
import LegendPanel from '@components/LegendPanel';
import ChartPanel from '@components/ChartPanel';
import ErrorDisplay from '@/components/displays/ErrorDisplay';
import LoadingDisplay from '@/components/displays/LoadingDisplay';

import { LOCATIONS } from '@lib/data/locations';
import type { ConstituencyData, LocalElectionWardData } from '@lib/types';
import { DEFAULT_MAP_OPTIONS } from '@lib/types/mapOptions';

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
	const activeDataset = useDatasetManager(
		activeDatasetId,
		localElectionData.datasets,
		generalElectionData.datasets,
		populationData.datasets
	);

	// Boundary data
	const { boundaryData, isLoading: geojsonLoading } = useBoundaryData(selectedLocation);

	const codeMapper = useCodeMapper(boundaryData);

	const geojson = useMemo(() => {
		if (!activeDataset) return null;
		if (activeDataset.boundaryType === 'ward') {
			return boundaryData.ward[activeDataset.wardYear];
		} else if (activeDataset.boundaryType === 'constituency') {
			return boundaryData.constituency[activeDataset.constituencyYear];
		}
		return null;
	}, [activeDataset, boundaryData]);

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
		onWardHover: activeDataset?.boundaryType === 'ward' ? onWardHover : undefined,
		onConstituencyHover: activeDataset?.boundaryType === 'constituency' ? onConstituencyHover : undefined,
		onLocationChange,
	});
	
	// Map options using custom hook
	const { mapOptions, setMapOptions: handleMapOptionsChange } = useMapOptions(DEFAULT_MAP_OPTIONS);

	// Aggregated data
	const { aggregatedLocalElectionData, aggregatedGeneralElectionData, aggregatedPopulationData } = useAggregatedElectionData({
		mapManager,
		boundaryData,
		localElectionDatasets: localElectionData.datasets,
		generalElectionDatasets: generalElectionData.datasets,
		populationDatasets: populationData.datasets,
		location: selectedLocation
	});

	const aggregatedData = useMemo(() => {
		if (!activeDataset || !aggregatedLocalElectionData || !aggregatedGeneralElectionData || !aggregatedPopulationData) return null;

		switch (activeDataset.type) {
			case 'local-election':
				return aggregatedLocalElectionData[activeDataset.year]
			case 'general-election':
				return aggregatedGeneralElectionData[activeDataset.year]
			case 'population':
				return aggregatedPopulationData[activeDataset.year]
		}
	}, [activeDataset, aggregatedGeneralElectionData, aggregatedLocalElectionData, aggregatedPopulationData])

	// Dataset change handler
	useEffect(() => {
		if (!geojson || geojsonLoading || !activeDataset || !mapManager) return;

		switch (activeDataset.type) {
			case 'population':
				switch (activeDatasetId) {
					case 'population-2020':
					case 'population-2021':
					case 'population-2022':
						mapManager.updateMapForPopulation(geojson, activeDataset, mapOptions['population']);
						break;
					case 'density-2020':
					case 'density-2021':
					case 'density-2022':
						mapManager.updateMapForPopulationDensity(geojson, activeDataset, mapOptions['density'])
						break
					case 'gender-2020':
					case 'gender-2021':
					case 'gender-2022':
						mapManager.updateMapForGender(geojson, activeDataset, mapOptions['gender'])
						break
				}
				break;
			case 'general-election':
				mapManager.updateMapForGeneralElection(
					geojson, 
					activeDataset, 
					mapOptions[activeDataset.type]
				);
				break;
			case 'local-election':
				mapManager.updateMapForLocalElection(
					geojson, 
					activeDataset, 
					mapOptions[activeDataset.type]
				);
				break;
		}
	}, [geojson, geojsonLoading, activeDataset, activeDatasetId, mapManager, mapOptions]);

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

	return (
		<div style={{ width: '100%', height: '100vh', position: 'relative' }}>
			<div className="fixed inset-0 z-50 h-full w-full pointer-events-none">
				<div className="absolute left-0 flex h-full">
					<ControlPanel
						selectedLocation={selectedLocation}
						onLocationClick={handleLocationClick}
						population={populationData.datasets['population-2022'].populationData!}
					/>
				</div>

				<div className="absolute right-0 flex h-full">
					<LegendPanel 
						activeDatasetId={activeDatasetId}
						activeDataset={activeDataset}
						aggregatedData={aggregatedData}
						mapOptions={mapOptions}
						onMapOptionsChange={handleMapOptionsChange}
					/>
					<ChartPanel
						selectedLocation={selectedLocation}
						selectedWard={selectedWardData}
						selectedConstituency={selectedConstituencyData}
						activeDatasetId={activeDatasetId}
						activeDataset={activeDataset}
						boundaryData={boundaryData}
						localElectionDatasets={localElectionData.datasets}
						generalElectionDatasets={generalElectionData.datasets}
						populationDatasets={populationData.datasets}
						setActiveDatasetId={setActiveDatasetId}
						aggregatedLocalElectionData={aggregatedLocalElectionData}
						aggregatedGeneralElectionData={aggregatedGeneralElectionData}
						aggregatedPopulationData={aggregatedPopulationData}
						codeMapper={codeMapper}
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