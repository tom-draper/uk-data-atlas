// Mapbox GL support. Inactive by default — webpack aliases mapbox-gl to a stub
// unless NEXT_PUBLIC_MAP_TYPE=mapbox.
//
// To enable:
//   1. npm install mapbox-gl
//   2. Set NEXT_PUBLIC_MAP_TYPE=mapbox and NEXT_PUBLIC_MAPBOX_TOKEN=<your token>
import { useCallback, useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
//import mapboxgl from "mapbox-gl";

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

			mapboxgl.accessToken = token;

			try {
				// Cast needed: mapboxgl.Map and maplibregl.Map share the same API but have
				// different type declarations. The stub Map type is used when mapbox-gl is
				// not installed; the real mapboxgl.Map is used when it is.
				mapRef.current = new mapboxgl.Map({
					container: el,
					style,
					center,
					zoom,
					maxBounds,
					preserveDrawingBuffer: true,
				}) as unknown as maplibregl.Map;
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
