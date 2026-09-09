"use client";
import { useEffect, useMemo, useState } from "react";
import { useMapManager } from "@lib/hooks/useMapManager";
import { useInteractionHandlers } from "@/lib/hooks/useInteractionHandlers";
import { useMapOptions } from "@/lib/hooks/useMapOptions";
import { useBoundaryData } from "@/lib/hooks/useBoundaryData";
import { useActiveGeometry } from "@/lib/hooks/useActiveGeometry";
import { useCodeMapper } from "@/lib/hooks/useCodeMapper";
import { useMapInitialization } from "@/lib/hooks/useMapInitialization";
import { useMapStyle } from "@/lib/hooks/useMapStyle";
import { useMapCamera } from "@/lib/hooks/useMapCamera";
import { useLocalElectionDatasets } from "@/lib/hooks/useLocalElectionDatasets";
import { getActiveDataset } from "@/lib/helpers/activeDataset";
import { filterGeometryToDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import { getChartDatasetDefinition } from "@/lib/datasets";
import { boundaryTypeForDatasetType } from "@/lib/datasets/boundaryRequirements";
import { boundaryCapabilityFor } from "@/lib/data/boundaries/capabilities";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";

import MapView from "@components/MapView";
import UIOverlay from "@components/UIOverlay";

import type {
	ActiveViz,
	Datasets,
	SelectedArea,
	BoundaryData,
	BoundaryType,
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

	// `boundaryData` carries properties alone, which is all the charts read.
	// Drawing needs coordinates, so the active vintage's geometry is fetched
	// on its own rather than the whole catalogue being held decoded.
	const { geometry: rawGeojson } = useActiveGeometry(
		!activeDataset || activeDataset.type === "network"
			? undefined
			: (activeDataset.boundaryType as BoundaryType),
		!activeDataset || activeDataset.type === "network"
			? undefined
			: activeDataset.boundaryYear,
		selectedLocation ?? null,
		getLadForWard,
		constituencyLadOverlaps,
	);

	const geojson = useMemo(() => {
		if (!rawGeojson || !activeDataset || !("data" in activeDataset))
			return rawGeojson;
		// The compiled payload carries coverage for production data, while the
		// definition keeps the map correct if a client is still holding a prior
		// payload after a hot reload or CDN update.
		const coverageCountries =
			activeDataset.coverageCountries ??
			getChartDatasetDefinition(activeDataset.type)?.coverageCountries;
		const coverageDataset = coverageCountries
			? { ...activeDataset, coverageCountries }
			: activeDataset;
		const coverageGeometry = filterGeometryToDatasetCoverage(
			rawGeojson,
			coverageDataset,
		);
		const dataKeys = new Set(
			Object.keys(activeDataset.data as Record<string, unknown>),
		);
		// A country-specific payload can have no records even though the source
		// covers that country (for example, a year without Welsh elections).
		// Keep its declared coverage visible, but preserve the empty-map behaviour
		// for datasets that have no published coverage at all.
		if (dataKeys.size === 0)
			return coverageCountries
				? coverageGeometry
				: { ...coverageGeometry, features: [] };
		const boundaryType = activeDataset.boundaryType as BoundaryType;
		const codeKeys: readonly string[] = boundaryCapabilityFor(boundaryType)
			.filterGeometryToDatasetData
			? BOUNDARY_CATALOG[boundaryType].properties.code
			: [];
		if (codeKeys.length === 0) return coverageGeometry;
		const firstProps = coverageGeometry.features[0]
			?.properties as unknown as Record<string, unknown> | undefined;
		if (!firstProps) return coverageGeometry;
		const codeKey = codeKeys.find((k) => k in firstProps);
		if (!codeKey) return coverageGeometry;
		const filtered = coverageGeometry.features.filter(
			(f) =>
				f.properties &&
				dataKeys.has(
					(f.properties as unknown as Record<string, unknown>)[
						codeKey
					] as string,
				),
		);
		if (filtered.length === coverageGeometry.features.length)
			return coverageGeometry;
		return { ...coverageGeometry, features: filtered };
	}, [rawGeojson, activeDataset]);

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
