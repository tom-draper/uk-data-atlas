// components/MapInterface.tsx
'use client';
import { useCallback, useMemo, useState } from 'react';
import { useData } from '@lib/contexts/dataContext';
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
import type { ConstituencyData, LocalElectionWardData } from '@lib/types';
import { useAggregatedData } from '@/lib/hooks/useAggregatedData';

const MAP_CONFIG = {
	style: 'mapbox://styles/mapbox/light-v11',
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
} as const;

export default function MapInterface() {
	const { activeDataset, datasets, selectedLocation, setSelectedLocation } = useData();

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

	// Get geojson for active dataset
	const geojson = useMemo(() => {
		if (!activeDataset) return null;
		if (activeDataset.boundaryType === 'ward') return boundaryData.ward[activeDataset.wardYear];
		if (activeDataset.boundaryType === 'constituency') return boundaryData.constituency[activeDataset.constituencyYear];
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

	// Compute aggregated data
	const aggregatedData = useAggregatedData({
		mapManager,
		boundaryData,
		datasets,
		location: selectedLocation,
	});

	if (!activeDataset) return null;

	if (!activeDataset) return null;

	return (
		<div style={{ width: '100%', height: '100vh', position: 'relative' }}>
			<UIOverlay
				selectedLocation={selectedLocation}
				selectedWardData={selectedWardData}
				selectedConstituencyData={selectedConstituencyData}
				boundaryData={boundaryData}
				aggregatedData={aggregatedData}
				codeMapper={codeMapper}
				mapOptions={mapOptions}
				onMapOptionsChange={handleMapOptionsChange}
				onLocationClick={handleLocationClick}
			/>
			<MapView
				mapRef={map}
				geojson={geojson}
				mapManager={mapManager}
				mapOptions={mapOptions}
				handleMapContainer={handleMapContainer}
			/>
		</div>
	);
}