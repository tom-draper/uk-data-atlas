// Only reached through a dynamic import guarded by NEXT_PUBLIC_MAP_PROVIDER,
// so MapLibre builds never bundle mapbox-gl or its stylesheet.
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { adaptMapPopup } from "@/lib/helpers/mapPopup";
import type {
	MapEngine,
	MapInstance,
	MapPopupOptions,
} from "@/lib/types/mapInstance";
import type { MapInitializationOptions } from "./options";

export function createMapboxMap(
	container: HTMLElement,
	{
		style,
		center,
		zoom,
		maxBounds,
		initialBounds,
		fitBoundsPadding = 40,
	}: MapInitializationOptions,
): MapInstance {
	const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
	if (!accessToken) throw new Error("Missing NEXT_PUBLIC_MAPBOX_TOKEN");

	const engine = new mapboxgl.Map({
		accessToken,
		container,
		style,
		...(initialBounds
			? {
					bounds: initialBounds,
					fitBoundsOptions: { padding: fitBoundsPadding },
				}
			: { center, zoom }),
		maxBounds,
		preserveDrawingBuffer: true,
	});
	// The app is typed against MapLibre; Mapbox shares the methods MapEngine
	// picks, but its declarations differ in detail.
	const map = engine as unknown as MapEngine;
	return Object.assign(map, {
		createPopup: (options?: MapPopupOptions) => {
			const popup = new mapboxgl.Popup(options);
			return adaptMapPopup(popup, () => {
				popup.addTo(engine);
			});
		},
	});
}
