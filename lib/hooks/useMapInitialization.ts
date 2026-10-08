import { useCallback, useEffect, useRef, useState } from "react";
import { createMapLibreMap } from "@/lib/map/createMapLibreMap";
import type { MapInitializationOptions } from "@/lib/map/options";
import type { MapInstance } from "@/lib/types/mapInstance";

export function useMapInitialization(options: MapInitializationOptions) {
	const mapRef = useRef<MapInstance | null>(null);
	const loadingRef = useRef(false);
	const [mapReady, setMapReady] = useState(false);

	const handleMapContainer = useCallback((el: HTMLDivElement | null) => {
		if (!el || mapRef.current || loadingRef.current) return;

		const attach = (map: MapInstance) => {
			mapRef.current = map;
			map.once("style.load", () => setMapReady(true));
		};

		// next.config.ts inlines NEXT_PUBLIC_MAP_PROVIDER, so this comparison is
		// a constant and the bundler drops the unused branch: a MapLibre build
		// never references the Mapbox chunk. Keep the comparison inline here;
		// reading it through a variable would defeat that.
		if (process.env.NEXT_PUBLIC_MAP_PROVIDER === "mapbox") {
			loadingRef.current = true;
			import("@/lib/map/createMapboxMap")
				.then(({ createMapboxMap }) => {
					// Unmounted while the chunk loaded.
					if (!loadingRef.current) return;
					loadingRef.current = false;
					attach(createMapboxMap(el, options));
				})
				.catch((err) => {
					loadingRef.current = false;
					console.error("Failed to initialize Mapbox map:", err);
				});
			return;
		}

		try {
			attach(createMapLibreMap(el, options));
		} catch (err) {
			console.error("Failed to initialize MapLibre map:", err);
		}
	}, []);

	useEffect(() => {
		return () => {
			loadingRef.current = false;
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
				setMapReady(false);
			}
		};
	}, []);

	return { mapRef, handleMapContainer, mapReady };
}
