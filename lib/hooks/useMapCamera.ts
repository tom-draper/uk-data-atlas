import { useCallback, useEffect, useRef } from "react";
import type { RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { MAP_CONFIG } from "@/lib/config/map";
import { gazetteer } from "@/lib/data/gazetteer/static";

type MapWithExport = MapLibreMap & {
	once(type: "render", listener: () => void): void;
	triggerRepaint(): void;
};

/** Map camera and export commands exposed to the UI overlay. */
export function useMapCamera(
	mapRef: RefObject<MapLibreMap | null>,
	selectedLocation: string,
	styleReady: boolean,
	setSelectedLocation: (location: string) => void,
) {
	const initialFitDone = useRef(false);

	useEffect(() => {
		const map = mapRef.current;
		if (!styleReady || !map || initialFitDone.current) return;
		const bounds = gazetteer.boundsOf(selectedLocation);
		if (!bounds) return;
		initialFitDone.current = true;
		map.fitBounds(bounds, {
			padding: MAP_CONFIG.fitBoundsPadding,
			duration: 0,
		});
	}, [mapRef, selectedLocation, styleReady]);

	const onLocationClick = useCallback(
		(location: string) => {
			const map = mapRef.current;
			const bounds = gazetteer.boundsOf(location);
			if (!map || !bounds) return;
			map.fitBounds(bounds, {
				padding: MAP_CONFIG.fitBoundsPadding,
				duration: MAP_CONFIG.fitBoundsDuration,
				essential: true,
			});
			setSelectedLocation(location);
		},
		[mapRef, setSelectedLocation],
	);

	const onZoomIn = useCallback(() => {
		const map = mapRef.current;
		if (map) map.zoomTo(map.getZoom() + 1);
	}, [mapRef]);

	const onZoomOut = useCallback(() => {
		const map = mapRef.current;
		if (map) map.zoomTo(map.getZoom() - 1);
	}, [mapRef]);

	const onExport = useCallback(() => {
		const map = mapRef.current as MapWithExport | null;
		if (!map) return;
		map.once("render", () => {
			const link = document.createElement("a");
			link.href = map.getCanvas().toDataURL("image/png");
			link.download = "map.png";
			document.body.append(link);
			link.click();
			link.remove();
		});
		map.triggerRepaint();
	}, [mapRef]);

	return { onLocationClick, onZoomIn, onZoomOut, onExport };
}
