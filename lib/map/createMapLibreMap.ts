import { Protocol } from "pmtiles";
import { Map as MapLibreMap, Popup, addProtocol } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { adaptMapPopup } from "@/lib/helpers/mapPopup";
import type { MapInstance, MapPopupOptions } from "@/lib/types/mapInstance";
import type { MapInitializationOptions } from "./options";

const protocol = new Protocol();
addProtocol("pmtiles", protocol.tile);

export function createMapLibreMap(
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
	const engine = new MapLibreMap({
		container,
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
	return Object.assign(engine, {
		createPopup: (options?: MapPopupOptions) => {
			const popup = new Popup(options);
			return adaptMapPopup(popup, () => {
				popup.addTo(engine);
			});
		},
	});
}
