import { useCallback, useEffect, useRef, useState } from "react";
import { createMapLibreMap } from "@/lib/map/createMapLibreMap";
import type { MapInitializationOptions } from "@/lib/map/options";
import type { MapInstance } from "@/lib/types/mapInstance";

export function useMapInitialization(options: MapInitializationOptions) {
	const mapRef = useRef<MapInstance | null>(null);
	const [mapReady, setMapReady] = useState(false);

	const handleMapContainer = useCallback((el: HTMLDivElement | null) => {
		if (!el || mapRef.current) return;

		const attach = (map: MapInstance) => {
			mapRef.current = map;
			map.once("style.load", () => setMapReady(true));
		};

		try {
			attach(createMapLibreMap(el, options));
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
