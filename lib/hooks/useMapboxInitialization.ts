import { useEffect, useRef, useState } from "react";
import { adaptMapPopup } from "@/lib/helpers/mapPopup";
import type {
	MapInstance,
	MapPopupOptions,
} from "@/lib/types/mapInstance";

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
	const mapRef = useRef<MapInstance | null>(null);
	const [mapReady, setMapReady] = useState(false);

	const handleMapContainer = async (el: HTMLDivElement | null) => {
		if (!el || mapRef.current) return;

		const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
		if (!token) {
			console.error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");
			return;
		}

		try {
			const mapboxgl = (await import("mapbox-gl")).default;

			mapboxgl.accessToken = token;

			const engine = new mapboxgl.Map({
				container: el,
				style,
				center,
				zoom,
				maxBounds,
				preserveDrawingBuffer: true,
			});
			mapRef.current = Object.assign(engine, {
				createPopup: (options?: MapPopupOptions) => {
					const popup = new mapboxgl.Popup(options);
					return adaptMapPopup(popup, () => {
						popup.addTo(engine);
					});
				},
			});

			setMapReady(true);
		} catch (err) {
			console.error("Failed to initialize Mapbox map:", err);
		}
	};

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
