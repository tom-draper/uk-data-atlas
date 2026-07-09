"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMapManager } from "@lib/hooks/useMapManager";
import { useInteractionHandlers } from "@/lib/hooks/useInteractionHandlers";
import { useMapOptions } from "@/lib/hooks/useMapOptions";
import { useBoundaryData } from "@/lib/hooks/useBoundaryData";
import { useCodeMapper } from "@/lib/hooks/useCodeMapper";
import { useMapInitialization } from "@/lib/hooks/useMapInitialization";
import { getActiveDataset } from "@/lib/helpers/activeDataset";
import { normalizeElectionDatasetCodes } from "@/lib/data/election/local-election/normalize";

import MapView from "@components/MapView";
import UIOverlay from "@components/UIOverlay";

import type {
	ActiveViz,
	Datasets,
	SelectedArea,
	BoundaryData,
} from "@lib/types";
import { LSOA_CODE_KEYS, DATA_ZONE_CODE_KEYS, SOA_CODE_KEYS } from "@/lib/data/boundaries/boundaries";
import type { CustomDataset } from "@/lib/types/custom";
import { MAP_CONFIG } from "@/lib/config/map";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { BASE_MAP_STYLES } from "@/lib/config/baseMapStyles";
import { gazetteer } from "@lib/data/gazetteer/static";
import maplibregl from "maplibre-gl";

interface MapInterfaceProps {
	datasets: Datasets;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	selectedLocation: string;
	setSelectedLocation: (location: string) => void;
	customDatasets: CustomDataset[];
	addCustomDataset: (dataset: CustomDataset) => void;
	roadSafetyDatasets: CustomDataset[];
	onError?: (error: Error) => void;
}

export default function MapInterface({
	datasets,
	activeViz,
	setActiveViz,
	selectedLocation,
	setSelectedLocation,
	customDatasets,
	addCustomDataset,
	roadSafetyDatasets,
	onError,
}: MapInterfaceProps) {
	const [selectedArea, setSelectedArea] = useState<SelectedArea | null>(null);
	const [loadedStyleId, setLoadedStyleId] = useState<string | null>(null);

	const codeMapper = useCodeMapper();
	const { addWardLadMappings } = codeMapper;

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
		boundaryCodes,
		isLoading: boundariesLoading,
		error: boundaryError,
	} = useBoundaryData(selectedLocation, codeMapper);

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
			]),
		[datasets, activeViz, customDatasets, roadSafetyDatasets],
	);

	const rawGeojson = !activeDataset
		? null
		: (boundaryData[activeDataset.boundaryType as keyof BoundaryData]?.[
				activeDataset.boundaryYear
			] ?? null);

	const geojson = useMemo(() => {
		if (!rawGeojson || !activeDataset || !("data" in activeDataset)) return rawGeojson;
		const dataKeys = new Set(Object.keys(activeDataset.data as Record<string, unknown>));
		if (dataKeys.size === 0) return rawGeojson;
		const codeKeys: readonly string[] =
			activeDataset.boundaryType === "lsoa" ? LSOA_CODE_KEYS :
			activeDataset.boundaryType === "dataZone" ? DATA_ZONE_CODE_KEYS :
			activeDataset.boundaryType === "superOutputArea" ? SOA_CODE_KEYS :
			[];
		if (codeKeys.length === 0) return rawGeojson;
		const firstProps = rawGeojson.features[0]?.properties as unknown as Record<string, unknown> | undefined;
		if (!firstProps) return rawGeojson;
		const codeKey = codeKeys.find(k => k in firstProps);
		if (!codeKey) return rawGeojson;
		const filtered = rawGeojson.features.filter(f => f.properties && dataKeys.has((f.properties as unknown as Record<string, unknown>)[codeKey] as string));
		if (filtered.length === rawGeojson.features.length) return rawGeojson;
		return { ...rawGeojson, features: filtered };
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

	const handleLocationClick = (location: string) => {
		const bounds = gazetteer.boundsOf(location);
		if (!map.current || !bounds) return;

		setSelectedLocation(location);

		requestAnimationFrame(() => {
			map.current?.fitBounds(bounds, {
				padding: MAP_CONFIG.fitBoundsPadding,
				duration: MAP_CONFIG.fitBoundsDuration,
			});
		});
	};

	const handleZoomIn = () => {
		const currentMap = map.current;
		if (currentMap) currentMap.zoomTo(currentMap.getZoom() + 1);
	};

	const handleZoomOut = () => {
		const currentMap = map.current;
		if (currentMap) currentMap.zoomTo(currentMap.getZoom() - 1);
	};

	const handleExport = () => {
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
	};

	const { getCodeForYear } = codeMapper;
	const normalizedDatasets = useMemo(() => {
		if (!boundaryCodes?.ward) return datasets;

		const normalizedLocalElection = Object.fromEntries(
			Object.entries(datasets.localElection).map(([year, dataset]) => {
				const validCodes = boundaryCodes.ward[dataset.boundaryYear];
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
	}, [datasets, boundaryCodes?.ward, getCodeForYear]);

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
	);
}
