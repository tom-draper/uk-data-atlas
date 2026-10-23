import type { LngLatLike, Map as MapLibreMap } from "maplibre-gl";

/** MapLibre methods used by the app. */
export type MapEngine = Pick<
	MapLibreMap,
	| "addLayer"
	| "addSource"
	| "fitBounds"
	| "getCanvas"
	| "getLayer"
	| "getSource"
	| "getZoom"
	| "isStyleLoaded"
	| "off"
	| "on"
	| "queryRenderedFeatures"
	| "remove"
	| "removeLayer"
	| "removeSource"
	| "setFeatureState"
	| "setFilter"
	| "setLayoutProperty"
	| "setPaintProperty"
	| "setStyle"
	| "triggerRepaint"
	| "once"
	| "zoomTo"
>;

export type MapPopupOptions = {
	className?: string;
	closeButton?: boolean;
	closeOnClick?: boolean;
	offset?: number;
};

export interface MapPopup {
	addClassName(name: string): MapPopup;
	addTo(): MapPopup;
	remove(): MapPopup;
	removeClassName(name: string): MapPopup;
	setDOMContent(node: Node): MapPopup;
	setLngLat(lngLat: LngLatLike): MapPopup;
}

/** The map interface used by hooks and rendering modules. */
export type MapInstance = MapEngine & {
	createPopup(options?: MapPopupOptions): MapPopup;
};
