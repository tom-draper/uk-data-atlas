"use client";
import { useEffect, useMemo, useState } from "react";
import { useMapManager } from "@lib/hooks/useMapManager";
import { useInteractionHandlers } from "@/lib/hooks/useInteractionHandlers";
import { useMapOptions } from "@/lib/hooks/useMapOptions";
import { useBoundaryData } from "@/lib/hooks/useBoundaryData";
import { useActiveDatasetGeometry } from "@/lib/hooks/useActiveDatasetGeometry";
import { useCodeMapper } from "@/lib/hooks/useCodeMapper";
import { useMapInitialization } from "@/lib/hooks/useMapInitialization";
import { useMapStyle } from "@/lib/hooks/useMapStyle";
import { useMapCamera } from "@/lib/hooks/useMapCamera";
import { useLocalElectionDatasets } from "@/lib/hooks/useLocalElectionDatasets";
import { getActiveDataset } from "@/lib/helpers/activeDataset";
import { boundaryTypeForDatasetType } from "@/lib/datasets/boundaryRequirements";

import MapView from "@components/MapView";
import UIOverlay from "@components/UIOverlay";

import type {
	ActiveViz,
	Datasets,
	SelectedArea,
	BoundaryData,
} from "@lib/types";
import type { CustomDataset } from "@/lib/types/custom";
import type { NetworkDataset } from "@/lib/types/network";
import { MAP_CONFIG } from "@/lib/config/map";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { gazetteer } from "@lib/data/gazetteer/static";
import { ThemeProvider } from "@/lib/context/ThemeContext";

interface MapInterfaceProps {
	datasets: Datasets;
	datasetsLoading: boolean;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	selectedLocation: string;
	setSelectedLocation: (location: string) => void;
	customDatasets: CustomDataset[];
	addCustomDataset: (dataset: CustomDataset) => void;
	roadSafetyDatasets: CustomDataset[];
	networkDatasets: NetworkDataset[];
	onError?: (error: Error) => void;
}

export default function MapInterface({
	datasets,
	datasetsLoading,
	activeViz,
	setActiveViz,
	selectedLocation,
	setSelectedLocation,
	customDatasets,
	addCustomDataset,
	roadSafetyDatasets,
	networkDatasets,
	onError,
}: MapInterfaceProps) {
	const [selectedArea, setSelectedArea] = useState<SelectedArea | null>(null);

	const codeMapper = useCodeMapper();
	const { getLadForWard } = codeMapper;

	const {
		boundaryData,
		wardCodes,
		constituencyLadOverlaps,
		isLoading: boundariesLoading,
		error: boundaryError,
	} = useBoundaryData(
		boundaryTypeForDatasetType(activeViz?.datasetType),
		selectedLocation,
		codeMapper,
	);

	useEffect(() => {
		if (boundaryError) onError?.(boundaryError);
	}, [boundaryError, onError]);

	// Map setup
	const {
		mapRef: map,
		handleMapContainer,
		mapReady,
	} = useMapInitialization({
		...MAP_CONFIG,
		initialBounds: gazetteer.boundsOf(selectedLocation),
		fitBoundsPadding: MAP_CONFIG.fitBoundsPadding,
	});
	const { mapOptions, setMapOptions: handleMapOptionsChange } =
		useMapOptions(DEFAULT_MAP_OPTIONS);
	const styleReady = useMapStyle(map, mapReady, mapOptions.baseStyle.id);

	// Stable interaction handlers - created once, never change identity
	const interactionHandlers = useInteractionHandlers({
		setSelectedLocation,
		setSelectedArea,
	});

	const activeDataset = useMemo(
		() =>
			getActiveDataset(datasets, activeViz, [
				...customDatasets,
				...roadSafetyDatasets,
				...networkDatasets,
			]),
		[
			datasets,
			activeViz,
			customDatasets,
			roadSafetyDatasets,
			networkDatasets,
		],
	);

	const { geometry: geojson } = useActiveDatasetGeometry(
		activeDataset,
		selectedLocation ?? null,
		getLadForWard,
		constituencyLadOverlaps,
	);

	// Initialize map manager with stable callbacks
	const mapManager = useMapManager({
		mapRef: map,
		mapReady,
		interactionHandlers,
	});

	const { onLocationClick, onZoomIn, onZoomOut, onExport } = useMapCamera(
		map,
		selectedLocation,
		styleReady,
		setSelectedLocation,
	);

	const normalizedDatasets = useLocalElectionDatasets(
		datasets,
		wardCodes,
		codeMapper,
	);

	const chartsLoading = datasetsLoading || boundariesLoading || !mapManager;

	return (
		<ThemeProvider value={mapOptions.baseStyle.id === "darkMatter"}>
			<div className="relative w-full h-screen">
				{!mapOptions.visibility.hideOverlay && (
					<UIOverlay
						selectedLocation={selectedLocation}
						selectedArea={selectedArea}
						boundaryData={boundaryData}
						mapOptions={mapOptions}
						codeMapper={codeMapper}
						onMapOptionsChange={handleMapOptionsChange}
						onLocationClick={onLocationClick}
						onZoomIn={onZoomIn}
						onZoomOut={onZoomOut}
						activeDataset={activeDataset}
						activeViz={activeViz}
						setActiveViz={setActiveViz}
						mapManager={mapManager}
						chartsLoading={chartsLoading}
						datasets={normalizedDatasets}
						customDatasets={customDatasets}
						addCustomDataset={addCustomDataset}
						roadSafetyDatasets={roadSafetyDatasets}
						networkDatasets={networkDatasets}
						onExport={onExport}
					/>
				)}
				<MapView
					activeDataset={activeDataset}
					activeViz={activeViz}
					geojson={geojson}
					mapManager={mapManager}
					mapOptions={mapOptions}
					handleMapContainer={handleMapContainer}
					styleReady={styleReady}
					selectedLocation={selectedLocation}
				/>
			</div>
		</ThemeProvider>
	);
}
