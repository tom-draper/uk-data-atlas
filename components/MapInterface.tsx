"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMapManager } from "@lib/hooks/useMapManager";
import { useInteractionHandlers } from "@/lib/hooks/useInteractionHandlers";
import { useMapOptions } from "@/lib/hooks/useMapOptions";
import { useBoundaryData } from "@/lib/hooks/useBoundaryData";
import { useAggregatedData } from "@/lib/hooks/useAggregatedData";
import { useCodeMapper } from "@/lib/hooks/useCodeMapper";
import { useMapInitialization } from "@/lib/hooks/useMapInitialization";
import { getActiveDataset } from "@/lib/helpers/activeDataset";

import MapView from "@components/MapView";
import UIOverlay from "@components/UIOverlay";

import type {
	ActiveViz,
	Datasets,
	SelectedArea,
	BoundaryData,
} from "@lib/types";
import type { CustomDataset } from "@/lib/types/custom";
import { MAP_CONFIG } from "@/lib/config/map";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { LOCATIONS } from "@lib/data/locations";
import maplibregl from "maplibre-gl";

interface MapInterfaceProps {
	datasets: Datasets;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	selectedLocation: string;
	setSelectedLocation: (location: string) => void;
	customDataset: CustomDataset | null;
	setCustomDataset: (dataset: CustomDataset | null) => void;
	onError?: (error: Error) => void;
}

export default function MapInterface({
	datasets,
	activeViz,
	setActiveViz,
	selectedLocation,
	setSelectedLocation,
	customDataset,
	setCustomDataset,
	onError,
}: MapInterfaceProps) {
	const [selectedArea, setSelectedArea] = useState<SelectedArea | null>(null);

	const codeMapper = useCodeMapper();

	// Supplement the code mapper with ward→LAD mappings from election data.
	// Boundary files older than 2022 lack LAD properties, so wards that were
	// reorganised between 2021 and 2022 (e.g. Bury and Rochdale) can't be
	// resolved from boundary metadata alone. The election CSVs carry ladCode
	// per row so we can fill the gap here.
	useEffect(() => {
		if (!codeMapper) return;
		const mappings: Record<string, string> = {};
		for (const dataset of Object.values(datasets.localElection)) {
			for (const ward of Object.values(dataset.data)) {
				if (ward.wardCode && ward.ladCode && ward.ladCode !== "Unknown") {
					mappings[ward.wardCode] = ward.ladCode;
				}
			}
		}
		if (Object.keys(mappings).length > 0) {
			codeMapper.addWardLadMappings(mappings);
		}
	}, [datasets.localElection, codeMapper]);

	const {
		boundaryData,
		boundaryCodes,
		isLoading: boundariesLoading,
		error: boundaryError,
	} = useBoundaryData(selectedLocation, codeMapper);

	useEffect(() => {
		if (boundaryError) onError?.(boundaryError);
	}, [boundaryError, onError]);

	// Map setup
	const { mapRef: map, handleMapContainer, mapReady } =
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
		return getActiveDataset(datasets, activeViz, customDataset);
	}, [datasets, activeViz, customDataset]);

	// Get geojson for active dataset
	const geojson = useMemo(() => {
		if (!activeDataset) return null;
		return (
			boundaryData[activeDataset.boundaryType as keyof BoundaryData]?.[
				activeDataset.boundaryYear
			] ?? null
		);
	}, [activeDataset, boundaryData]);

	// Initialize map manager with stable callbacks
	const mapManager = useMapManager({
		mapRef: map,
		mapReady,
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
		type MapWithExport = maplibregl.Map & {
			once(type: "render", listener: () => void): void;
			triggerRepaint(): void;
		};
		const mapInstance = map.current as MapWithExport | null;
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
		customDataset,
		location: selectedLocation,
	});
	const chartsLoading = boundariesLoading || !mapManager;

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
					chartsLoading={chartsLoading}
					datasets={datasets}
					customDataset={customDataset}
					setCustomDataset={setCustomDataset}
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
