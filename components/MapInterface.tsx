"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMapManager } from "@lib/hooks/useMapManager";
import { useInteractionHandlers } from "@/lib/hooks/useInteractionHandlers";
import { useMapOptions } from "@/lib/hooks/useMapOptions";
import { useBoundaryData } from "@/lib/hooks/useBoundaryData";
import { useActiveGeometry } from "@/lib/hooks/useActiveGeometry";
import { useCodeMapper } from "@/lib/hooks/useCodeMapper";
import { useMapInitialization } from "@/lib/hooks/useMapInitialization";
import { getActiveDataset } from "@/lib/helpers/activeDataset";
import { filterGeometryToDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import { getChartDatasetDefinition } from "@/lib/datasets";
import { boundaryTypeForDatasetType } from "@/lib/datasets/boundaryRequirements";
import { boundaryCapabilityFor } from "@/lib/data/boundaries/capabilities";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import { normalizeElectionDatasetCodes } from "@/lib/data/election/local-election/normalize";

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
import { BASE_MAP_STYLES } from "@/lib/config/baseMapStyles";
import { gazetteer } from "@lib/data/gazetteer/static";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import type { Map as MapLibreMap } from "maplibre-gl";

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
	const [loadedStyleId, setLoadedStyleId] = useState<string | null>(null);

	const codeMapper = useCodeMapper();
	const { addWardLadMappings, getLadForWard } = codeMapper;

	// Supplement the code mapper with ward→LAD mappings from election data.
	// Boundary files older than 2022 lack LAD properties, so wards that were
	// reorganised between 2021 and 2022 (e.g. Bury and Rochdale) can't be
	// resolved from boundary metadata alone. The election CSVs carry ladCode
	// per row so we can fill the gap here.
	useEffect(() => {
		const mappings: Record<string, string> = {};
		for (const dataset of Object.values(datasets.localElection)) {
			for (const ward of Object.values(dataset.data)) {
				if (
					ward.wardCode &&
					ward.ladCode &&
					ward.ladCode !== "Unknown"
				) {
					mappings[ward.wardCode] = ward.ladCode;
				}
			}
		}
		if (Object.keys(mappings).length > 0) {
			addWardLadMappings(mappings);
		}
	}, [datasets.localElection, addWardLadMappings]);

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
	const styleReady = loadedStyleId === mapOptions.baseStyle.id;

	// Track whether the initial style has been applied (style is loaded in useMapLibreInitialization).
	const initialStyleApplied = useRef(false);

	// Switch base map style and re-render data layers after the new style loads.
	// On the initial mapReady=true, the style is already loaded, so skip setStyle()
	// and just bump the version counter so useMapUpdates fires immediately.
	useEffect(() => {
		const mapInstance = map.current;
		if (!mapInstance || !mapReady) return;

		const currentStyleId = mapOptions.baseStyle.id;

		const handleStyleReady = () => {
			// Wait until style + sources + sprite state settle
			if (mapInstance.isStyleLoaded()) {
				setLoadedStyleId(currentStyleId);
			}
		};

		mapInstance.on("idle", handleStyleReady);

		const styleUrl = BASE_MAP_STYLES.find(
			(s) => s.id === currentStyleId,
		)?.url;

		// Initial load
		if (!initialStyleApplied.current) {
			initialStyleApplied.current = true;

			handleStyleReady();

			return () => {
				mapInstance.off("idle", handleStyleReady);
			};
		}

		// Style switch
		if (styleUrl) {
			mapInstance.setStyle(styleUrl);
		}

		return () => {
			mapInstance.off("idle", handleStyleReady);
		};
	}, [mapOptions.baseStyle.id, mapReady]);

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

	const initialFitDone = useRef(false);

	// Fit to initial location from URL params once on first style ready
	useEffect(() => {
		if (!styleReady || !map.current || initialFitDone.current) return;
		const bounds = gazetteer.boundsOf(selectedLocation);
		if (!bounds) return;
		initialFitDone.current = true;
		map.current.fitBounds(bounds, {
			padding: MAP_CONFIG.fitBoundsPadding,
			duration: 0,
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [styleReady]);

	const handleLocationClick = useCallback(
		(location: string) => {
			const bounds = gazetteer.boundsOf(location);
			if (!map.current || !bounds) return;

			// Start the camera transition before the location change re-renders the
			// panel and refreshes point data; otherwise that work can delay the first
			// animation frame and make the move appear instantaneous.
			map.current.fitBounds(bounds, {
				padding: MAP_CONFIG.fitBoundsPadding,
				duration: MAP_CONFIG.fitBoundsDuration,
				// A deliberate location selection should retain its spatial context even
				// when the browser has a reduced-motion preference.
				essential: true,
			});
			setSelectedLocation(location);
			// `map` is a ref, stable for the component's lifetime.
			// eslint-disable-next-line react-hooks/exhaustive-deps
		},
		[setSelectedLocation],
	);

	const handleZoomIn = useCallback(() => {
		const currentMap = map.current;
		if (currentMap) currentMap.zoomTo(currentMap.getZoom() + 1);
	}, []);

	const handleZoomOut = useCallback(() => {
		const currentMap = map.current;
		if (currentMap) currentMap.zoomTo(currentMap.getZoom() - 1);
	}, []);

	const handleExport = useCallback(() => {
		type MapWithExport = MapLibreMap & {
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
	}, []);

	const { getCodeForYear } = codeMapper;
	const normalizedDatasets = useMemo(() => {
		if (!wardCodes) return datasets;

		const normalizedLocalElection = Object.fromEntries(
			Object.entries(datasets.localElection).map(([year, dataset]) => {
				const validCodes = wardCodes[dataset.boundaryYear];
				if (!validCodes) return [year, dataset];
				return [
					year,
					normalizeElectionDatasetCodes(
						dataset,
						validCodes,
						getCodeForYear,
					),
				];
			}),
		) as typeof datasets.localElection;

		return { ...datasets, localElection: normalizedLocalElection };
	}, [datasets, wardCodes, getCodeForYear]);

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
						onLocationClick={handleLocationClick}
						onZoomIn={handleZoomIn}
						onZoomOut={handleZoomOut}
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
					styleReady={styleReady}
					selectedLocation={selectedLocation}
				/>
			</div>
		</ThemeProvider>
	);
}
