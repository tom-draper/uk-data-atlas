// Mapbox GL support — disabled by default (mapbox-gl not installed).
// To re-enable: npm install mapbox-gl, then set NEXT_PUBLIC_MAP_TYPE=mapbox.
import { useCallback, useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";

interface UseMapInitializationOptions {
	style: string;
	center: [number, number];
	zoom: number;
	maxBounds: [number, number, number, number];
}

export function useMapboxInitialization({
	style,
	center,
	zoom,
	maxBounds,
}: UseMapInitializationOptions) {
	const mapRef = useRef<maplibregl.Map | null>(null);

	const handleMapContainer = useCallback(
		(el: HTMLDivElement | null) => {
			if (!el || mapRef.current) return;

			const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
			if (!token) {
				console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
				return;
			}

			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const mapboxgl = require("mapbox-gl");
			mapboxgl.accessToken = token;

			try {
				mapRef.current = new mapboxgl.Map({
					container: el,
					style,
					center,
					zoom,
					maxBounds,
					preserveDrawingBuffer: true,
				});
			} catch (err) {
				console.error("Failed to initialize Mapbox map:", err);
			}
		},
		[style, center, zoom],
	);

	useEffect(() => {
		return () => {
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
		};
	}, []);

	return { mapRef, handleMapContainer };
}
