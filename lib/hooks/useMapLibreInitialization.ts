import { useCallback, useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface UseMapLibreInitializationOptions {
	style: string;
	center: [number, number];
	zoom: number;
	maxBounds: [number, number, number, number];
}

export function useMapLibreInitialization({
	style,
	center,
	zoom,
	maxBounds,
}: UseMapLibreInitializationOptions) {
	const mapRef = useRef<maplibregl.Map | null>(null);
	const [mapReady, setMapReady] = useState(false);

	const handleMapContainer = useCallback(
		(el: HTMLDivElement | null) => {
			if (!el || mapRef.current) return;

			try {
				mapRef.current = new maplibregl.Map({
					container: el,
					style,
					center,
					zoom,
					maxBounds,
					preserveDrawingBuffer: true,
				} as any);
				setMapReady(true);
			} catch (err) {
				console.error("Failed to initialize MapLibre map:", err);
			}
		},
		[style, center, zoom],
	);

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
