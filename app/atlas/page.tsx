// page.tsx
'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';

// Hooks
import { useLocalElectionData } from '@/lib/hooks/useLocalElectionData';
import { useGeneralElectionData } from '@/lib/hooks/useGeneralElectionData';
import { usePopulationData } from '@lib/hooks/usePopulationData';
import { useHousePriceData } from '@/lib/hooks/useHousePriceData';
import { useMapManager } from '@lib/hooks/useMapManager';
import { useMapInitialization } from '@lib/hooks/useMapboxInitialization';
import { useAggregatedChartData } from '@lib/hooks/useAggregatedChartData';
import { useInteractionHandlers } from '@/lib/hooks/useInteractionHandlers';
import { useBoundaryData } from '@/lib/hooks/useBoundaryData';
import { useDatasetManager } from '@/lib/hooks/useDatasetManager';
import { useCodeMapper } from '@/lib/hooks/useCodeMapper';
import { useMapOptions } from '@/lib/hooks/useMapOptions';

// Components
import ControlPanel from '@components/ControlPanel';
import LegendPanel from '@components/LegendPanel';
import ChartPanel from '@components/ChartPanel';
import ErrorDisplay from '@/components/displays/ErrorDisplay';
import LoadingDisplay from '@/components/displays/LoadingDisplay';

// Data & Types
import { LOCATIONS } from '@lib/data/locations';
import { DEFAULT_MAP_OPTIONS } from '@lib/types/mapOptions';
import type { ConstituencyData, LocalElectionWardData } from '@lib/types';

// Constants
const INITIAL_STATE = {
	location: 'Greater Manchester',
	datasetId: 'local-election-2024',
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

	// Data hooks
	const localElectionData = useLocalElectionData();
	const generalElectionData = useGeneralElectionData();
	const populationData = usePopulationData();
	const housePriceData = useHousePriceData();

	// Derived data
	const activeDataset = useDatasetManager(
		activeDatasetId,
		localElectionData.datasets,
		generalElectionData.datasets,
		populationData.datasets,
		housePriceData.datasets,
	);

	const { boundaryData, isLoading: geojsonLoading } = useBoundaryData(selectedLocation);
	const codeMapper = useCodeMapper(boundaryData);
	
	const geojson = useMemo(() => {
		if (!activeDataset) return null;
		if (activeDataset.boundaryType === 'ward') return boundaryData.ward[activeDataset.wardYear];
		if (activeDataset.boundaryType === 'constituency') return boundaryData.constituency[activeDataset.constituencyYear];
		return null;
	}, [activeDataset, boundaryData]);

	// Map setup
	const { mapRef: map, handleMapContainer } = useMapInitialization(MAP_CONFIG);
	const { mapOptions, setMapOptions: handleMapOptionsChange } = useMapOptions(DEFAULT_MAP_OPTIONS);

	// Interaction handlers
	const { onWardHover, onConstituencyHover, onLocationChange } = useInteractionHandlers({
		setSelectedWard,
		setSelectedConstituency,
		setSelectedLocation,
	});

	const mapManager = useMapManager({
		mapRef: map,
		geojson,
		onWardHover: activeDataset?.boundaryType === 'ward' ? onWardHover : undefined,
		onConstituencyHover: activeDataset?.boundaryType === 'constituency' ? onConstituencyHover : undefined,
		onLocationChange,
	});

	// Aggregated chart data
	const { 
		aggregatedLocalElectionData, 
		aggregatedGeneralElectionData, 
		aggregatedPopulationData, 
		aggregatedHousePriceData 
	} = useAggregatedChartData({
		mapManager,
		boundaryData,
		localElectionDatasets: localElectionData.datasets,
		generalElectionDatasets: generalElectionData.datasets,
		populationDatasets: populationData.datasets,
		housePriceDatasets: housePriceData.datasets,
		location: selectedLocation
	});

	const aggregatedData = useMemo(() => {
		if (!activeDataset) return null;

		const dataMap = {
			'local-election': aggregatedLocalElectionData,
			'general-election': aggregatedGeneralElectionData,
			'population': aggregatedPopulationData,
			'house-price': aggregatedHousePriceData,
		};

		return dataMap[activeDataset.type]?.[activeDataset.year] ?? null;
	}, [activeDataset, aggregatedLocalElectionData, aggregatedGeneralElectionData, aggregatedPopulationData, aggregatedHousePriceData]);

	// Update map when dataset changes
	useEffect(() => {
		if (!geojson || geojsonLoading || !activeDataset || !mapManager) return;

		const updateMap = () => {
			switch (activeDataset.type) {
				case 'population':
					const populationHandlers = {
						'age-distribution': () => mapManager.updateMapForAgeDistribution(geojson, activeDataset, mapOptions['age-distribution']),
						'population-density': () => mapManager.updateMapForPopulationDensity(geojson, activeDataset, mapOptions['population-density']),
						'gender': () => mapManager.updateMapForGender(geojson, activeDataset, mapOptions['gender']),
					};
					
					const handlerKey = Object.keys(populationHandlers).find(key => activeDatasetId.startsWith(key));
					populationHandlers[handlerKey as keyof typeof populationHandlers]?.();
					break;

				case 'general-election':
					mapManager.updateMapForGeneralElection(geojson, activeDataset, mapOptions[activeDataset.type]);
					break;

				case 'local-election':
					mapManager.updateMapForLocalElection(geojson, activeDataset, mapOptions[activeDataset.type]);
					break;

				case 'house-price':
					mapManager.updateMapForHousePrices(geojson, activeDataset, mapOptions[activeDataset.type]);
					break;
			}
		};

		updateMap();
	}, [geojson, geojsonLoading, activeDataset, activeDatasetId, mapManager, mapOptions]);

	// Location navigation
	const handleLocationClick = useCallback((location: string) => {
		const locationData = LOCATIONS[location];
		if (!mapManager || !locationData) return;

		setSelectedLocation(location);

		requestAnimationFrame(() => {
			map.current?.fitBounds(locationData.bounds, {
				padding: MAP_CONFIG.fitBoundsPadding,
				duration: MAP_CONFIG.fitBoundsDuration,
			});
		});
	}, [map, mapManager]);

	// Loading & error states
	const isLoading = localElectionData.loading || generalElectionData.loading || populationData.loading;
	const errorMessage = localElectionData.error || generalElectionData.error || populationData.error;

	if (isLoading) return <LoadingDisplay />;
	if (errorMessage) return <ErrorDisplay message={errorMessage ?? 'Error loading data'} />;
	if (!activeDataset) return <ErrorDisplay message="No datasets loaded" />;

	return (
		<div style={{ width: '100%', height: '100vh', position: 'relative' }}>
			{/* UI Overlay */}
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
						housePriceDatasets={housePriceData.datasets}
						setActiveDatasetId={setActiveDatasetId}
						aggregatedLocalElectionData={aggregatedLocalElectionData}
						aggregatedGeneralElectionData={aggregatedGeneralElectionData}
						aggregatedPopulationData={aggregatedPopulationData}
						aggregatedHousePriceData={aggregatedHousePriceData}
						codeMapper={codeMapper}
					/>
				</div>
			</div>

			{/* Map Container */}
			<div
				ref={handleMapContainer}
				style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
			/>
		</div>
	);
}