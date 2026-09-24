import { useCallback, useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { adaptMapPopup } from "@/lib/helpers/mapPopup";
import type {
	MapInstance,
	MapPopupOptions,
} from "@/lib/types/mapInstance";

interface UseMapLibreInitializationOptions {
	style: string;
	center: [number, number];
	zoom: number;
	maxBounds: [number, number, number, number];
	initialBounds?: [number, number, number, number];
	fitBoundsPadding?: number;
}

export function useMapLibreInitialization({
	style,
	center,
	zoom,
	maxBounds,
	initialBounds,
	fitBoundsPadding = 40,
}: UseMapLibreInitializationOptions) {
	const mapRef = useRef<MapInstance | null>(null);
	const [mapReady, setMapReady] = useState(false);

	const handleMapContainer = useCallback((el: HTMLDivElement | null) => {
		if (!el || mapRef.current) return;

		try {
			const engine = new MapLibreMap({
				container: el,
				style,
				...(initialBounds
					? {
							bounds: initialBounds,
							fitBoundsOptions: { padding: fitBoundsPadding },
						}
					: { center, zoom }),
				maxBounds,
				canvasContextAttributes: { preserveDrawingBuffer: true },
			});
			const map: MapInstance = Object.assign(engine, {
				createPopup: (options?: MapPopupOptions) => {
					const popup = new Popup(options);
					return adaptMapPopup(popup, () => {
						popup.addTo(engine);
					});
				},
			});
			mapRef.current = map;
			map.once("style.load", () => setMapReady(true));
		} catch (err) {
			console.error("Failed to initialize MapLibre map:", err);
		}
	}, []);

	useEffect(() => {
		return () => {
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
				setMapReady(false);
			}
		};
	}, []);

	return { mapRef, handleMapContainer, mapReady };
}
