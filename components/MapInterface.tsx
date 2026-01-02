"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { useMapManager } from "@lib/hooks/useMapManager";
import { useInteractionHandlers } from "@/lib/hooks/useInteractionHandlers";
import { useMapOptions } from "@/lib/hooks/useMapOptions";
import { useBoundaryData } from "@/lib/hooks/useBoundaryData";
import { useAggregatedData } from "@/lib/hooks/useAggregatedData";
import { useCodeMapper } from "@/lib/hooks/useCodeMapper";
import { useMapInitialization } from "@/lib/hooks/useMapInitialization";

import MapView from "@components/MapView";
import UIOverlay from "@components/UIOverlay";

import type { ActiveViz, Datasets, SelectedArea } from "@lib/types";
import { MAP_CONFIG } from "@/lib/config/map";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { LOCATIONS } from "@lib/data/locations";

interface MapInterfaceProps {
	datasets: Datasets;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	selectedLocation: string;
	setSelectedLocation: (location: string) => void;
	customDataset: any;
	setCustomDataset: (dataset: any) => void;
}

export default function MapInterface({
	datasets,
	activeViz,
	setActiveViz,
	selectedLocation,
	setSelectedLocation,
	customDataset,
	setCustomDataset,
}: MapInterfaceProps) {
	const [selectedArea, setSelectedArea] = useState<SelectedArea | null>(null);

	const codeMapper = useCodeMapper();
	const { boundaryData, boundaryCodes } = useBoundaryData(selectedLocation, codeMapper);

	// Map setup
	const { mapRef: map, handleMapContainer } =
		useMapInitialization(MAP_CONFIG);
	const { mapOptions, setMapOptions: handleMapOptionsChange } =
		useMapOptions(DEFAULT_MAP_OPTIONS);

	// Stable interaction handlers - created once, never change identity
	const interactionHandlers = useInteractionHandlers({
		setSelectedLocation,
		setSelectedArea,
	});

	// Get active dataset
	const activeDataset = useMemo(() => {
		if (activeViz.datasetType === "custom") return customDataset;
		return datasets[activeViz.datasetType]?.[activeViz.datasetYear];
	}, [datasets, activeViz.datasetType, activeViz.datasetYear]);

	// Get geojson for active dataset
	const geojson = useMemo(() => {
		if (!activeDataset) return null;
		return (
			boundaryData[activeDataset.boundaryType]?.[
			activeDataset.boundaryYear
			] ?? null
		);
	}, [activeDataset, boundaryData]);

	// Initialize map manager with stable callbacks
	const mapManager = useMapManager({
		mapRef: map,
		geojson,
		interactionHandlers,
	});

	// Location navigation - memoize with proper dependencies
	const handleLocationClick = useCallback(
		(location: string) => {
			const locationData = LOCATIONS[location];
			if (!map.current || !locationData) return;

			setSelectedLocation(location);

			// Use requestAnimationFrame for smooth animation
			requestAnimationFrame(() => {
				map.current?.fitBounds(locationData.bounds, {
					padding: MAP_CONFIG.fitBoundsPadding,
					duration: MAP_CONFIG.fitBoundsDuration,
				});
			});
		},
		[map, setSelectedLocation],
	);

	// Zoom handlers - create once
	const zoomHandlersRef = useRef({
		handleZoomIn: () => {
			const currentMap = map.current;
			if (currentMap) {
				currentMap.zoomTo(currentMap.getZoom() + 1);
			}
		},
		handleZoomOut: () => {
			const currentMap = map.current;
			if (currentMap) {
				currentMap.zoomTo(currentMap.getZoom() - 1);
			}
		},
	});

	const handleExport = useCallback(() => {
		const mapInstance = map.current;
		if (!mapInstance) return;

		mapInstance.once("render", () => {
			const canvas = mapInstance.getCanvas();
			const dataURL = canvas.toDataURL("image/png");

			const link = document.createElement("a");
			link.href = dataURL;
			link.download = "map.png";
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		});

		mapInstance.triggerRepaint();
	}, [map]);

	const aggregatedData = useAggregatedData({
		mapManager,
		boundaryData,
		datasets,
		location: selectedLocation,
	});

	return (
		<div className="relative w-full h-screen">
			{!mapOptions.visibility.hideOverlay && (
				<UIOverlay
					selectedLocation={selectedLocation}
					selectedArea={selectedArea}
					boundaryData={boundaryData}
					boundaryCodes={boundaryCodes}
					mapOptions={mapOptions}
					codeMapper={codeMapper}
					onMapOptionsChange={handleMapOptionsChange}
					onLocationClick={handleLocationClick}
					onZoomIn={zoomHandlersRef.current.handleZoomIn}
					onZoomOut={zoomHandlersRef.current.handleZoomOut}
					activeDataset={activeDataset}
					activeViz={activeViz}
					setActiveViz={setActiveViz}
					aggregatedData={aggregatedData}
					datasets={datasets}
					customDataset={customDataset}
					setCustomDataset={setCustomDataset}
					handleMapOptionsChange={handleMapOptionsChange}
					onExport={handleExport}
				/>
			)}
			<MapView
				activeDataset={activeDataset}
				activeViz={activeViz}
				geojson={geojson}
				mapManager={mapManager}
				mapOptions={mapOptions}
				handleMapContainer={handleMapContainer}
			/>
		</div>
	);
}
