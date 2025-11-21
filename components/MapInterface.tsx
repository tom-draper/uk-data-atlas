// components/MapInterface.tsx
'use client';
import { useCallback, useMemo, useState } from 'react';
import { useMapInitialization } from '@lib/hooks/useMapboxInitialization';
import { useMapManager } from '@lib/hooks/useMapManager';
import { useInteractionHandlers } from '@/lib/hooks/useInteractionHandlers';
import { useCodeMapper } from '@/lib/hooks/useCodeMapper';
import { useMapOptions } from '@/lib/hooks/useMapOptions';
import { useBoundaryData } from '@/lib/hooks/useBoundaryData';

import MapView from '@components/MapView';
import UIOverlay from '@components/UIOverlay';

import { LOCATIONS } from '@lib/data/locations';
import { DEFAULT_MAP_OPTIONS } from '@lib/types/mapOptions';
import type { ActiveViz, ConstituencyData, Datasets, LocalElectionWardData } from '@lib/types';
import { useAggregatedData } from '@/lib/hooks/useAggregatedData';

interface MapInterfaceProps {
	datasets: Datasets;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	selectedLocation: string;
	setSelectedLocation: (location: string) => void;
}

const MAP_CONFIG = {
	style: 'mapbox://styles/mapbox/light-v11',
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
} as const;

export default function MapInterface({
	datasets,
	activeViz,
	setActiveViz,
	selectedLocation,
	setSelectedLocation,
}: MapInterfaceProps) {
	// Local state
	const [selectedWardData, setSelectedWard] = useState<LocalElectionWardData | null>(null);
	const [selectedConstituencyData, setSelectedConstituency] = useState<ConstituencyData | null>(null);

	// Get boundary data
	const { boundaryData } = useBoundaryData(selectedLocation);
	const codeMapper = useCodeMapper(boundaryData);

	// Map setup
	const { mapRef: map, handleMapContainer } = useMapInitialization(MAP_CONFIG);
	const { mapOptions, setMapOptions: handleMapOptionsChange } = useMapOptions(DEFAULT_MAP_OPTIONS);

	// Interaction handlers
	const { onWardHover, onConstituencyHover, onLocationChange } = useInteractionHandlers({
		setSelectedWard,
		setSelectedConstituency,
		setSelectedLocation,
	});

	const activeDataset = useMemo(() => {
		return datasets[activeViz.datasetType][activeViz.datasetYear]
	}, [datasets, activeViz]);

	// Get geojson for active dataset
	const geojson = useMemo(() => {
		if (!activeDataset) return null;
		if (activeDataset.boundaryType === 'ward') return boundaryData.ward[activeDataset.boundaryYear];
		if (activeDataset.boundaryType === 'constituency') return boundaryData.constituency[activeDataset.boundaryYear];
		if (activeDataset.boundaryType === 'localAuthority') return boundaryData.localAuthority[activeDataset.boundaryYear];
		return null;
	}, [activeDataset, boundaryData]);

	// Initialize map manager
	const mapManager = useMapManager({
		mapRef: map,
		geojson,
		onWardHover: activeDataset?.boundaryType === 'ward' ? onWardHover : undefined,
		onConstituencyHover: activeDataset?.boundaryType === 'constituency' ? onConstituencyHover : undefined,
		onLocationChange,
	});

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
	}, [map, mapManager, setSelectedLocation]);

	const handleZoomIn = useCallback(() => {
		if (map.current) {
			map.current.zoomTo(map.current.getZoom() + 1);
		}
	}, []);

	const handleZoomOut = useCallback(() => {
		if (map.current) {
			map.current.zoomTo(map.current.getZoom() - 1);
		}
	}, []);

	const aggregatedData = useAggregatedData({
		mapManager,
		boundaryData,
		datasets,
		location: selectedLocation,
	});

	return (
		<div style={{ width: '100%', height: '100vh', position: 'relative' }}>
			<UIOverlay
				selectedLocation={selectedLocation}
				selectedWardData={selectedWardData}
				selectedConstituencyData={selectedConstituencyData}
				boundaryData={boundaryData}
				codeMapper={codeMapper}
				mapOptions={mapOptions}
				onMapOptionsChange={handleMapOptionsChange}
				onLocationClick={handleLocationClick}
				onZoomIn={handleZoomIn}
				onZoomOut={handleZoomOut}
				activeDataset={activeDataset}
				activeViz={activeViz}
				setActiveViz={setActiveViz}
				aggregatedData={aggregatedData}
				datasets={datasets}
				handleMapOptionsChange={handleMapOptionsChange}
			/>
			<MapView
				activeDataset={activeDataset}
				activeViz={activeViz}
				geojson={geojson}
				mapManager={mapManager}
				mapOptions={mapOptions}
				handleMapContainer={handleMapContainer}
			/>
		</div >
	);
}