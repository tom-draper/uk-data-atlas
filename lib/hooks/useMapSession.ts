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
import type { ActiveViz, Datasets, SelectedArea } from "@lib/types";
import type { CustomDataset } from "@/lib/types/custom";
import type { NetworkDataset } from "@/lib/types/network";
import { MAP_CONFIG } from "@/lib/config/map";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { gazetteer } from "@lib/data/gazetteer/static";

type MapSessionOptions = {
	datasets: Datasets;
	datasetsLoading: boolean;
	activeViz: ActiveViz;
	selectedLocation: string;
	setSelectedLocation: (location: string) => void;
	customDatasets: CustomDataset[];
	roadSafetyDatasets: CustomDataset[];
	networkDatasets: NetworkDataset[];
	onError?: (error: Error) => void;
};

/** Coordinate map lifecycle, data geometry, and map-facing commands. */
export function useMapSession({
	datasets,
	datasetsLoading,
	activeViz,
	selectedLocation,
	setSelectedLocation,
	customDatasets,
	roadSafetyDatasets,
	networkDatasets,
	onError,
}: MapSessionOptions) {
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
		boundaryTypeForDatasetType(activeViz.datasetType),
		selectedLocation,
		codeMapper,
	);

	useEffect(() => {
		if (boundaryError) onError?.(boundaryError);
	}, [boundaryError, onError]);

	const { mapRef, handleMapContainer, mapReady } = useMapInitialization({
		...MAP_CONFIG,
		initialBounds: gazetteer.boundsOf(selectedLocation),
		fitBoundsPadding: MAP_CONFIG.fitBoundsPadding,
	});
	const { mapOptions, setMapOptions: handleMapOptionsChange } =
		useMapOptions(DEFAULT_MAP_OPTIONS);
	const styleReady = useMapStyle(mapRef, mapReady, mapOptions.baseStyle.id);
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
		selectedLocation,
		getLadForWard,
		constituencyLadOverlaps,
	);
	const mapManager = useMapManager({
		mapRef,
		mapReady,
		interactionHandlers,
	});
	const { onLocationClick, onZoomIn, onZoomOut, onExport } = useMapCamera(
		mapRef,
		selectedLocation,
		styleReady,
		setSelectedLocation,
	);
	const normalizedDatasets = useLocalElectionDatasets(
		datasets,
		wardCodes,
		codeMapper,
	);

	return {
		selectedArea,
		boundaryData,
		codeMapper,
		mapOptions,
		handleMapOptionsChange,
		onLocationClick,
		onZoomIn,
		onZoomOut,
		onExport,
		activeDataset,
		geojson,
		mapManager,
		styleReady,
		handleMapContainer,
		normalizedDatasets,
		chartsLoading: datasetsLoading || boundariesLoading || !mapManager,
	};
}
