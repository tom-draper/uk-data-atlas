import type { LngLatLike } from "maplibre-gl";
import type { MapPopup } from "@/lib/types/mapInstance";

interface PopupEngine {
	addClassName(name: string): unknown;
	removeClassName(name: string): unknown;
	remove(): unknown;
	setDOMContent(node: Node): unknown;
	setLngLat(lngLat: LngLatLike): unknown;
}

/** Hide provider-specific popup attachment behind the map instance. */
export const adaptMapPopup = (
	popup: PopupEngine,
	attach: () => void,
): MapPopup => {
	let adapted: MapPopup;
	adapted = {
		addClassName(name) {
			popup.addClassName(name);
			return adapted;
		},
		addTo() {
			attach();
			return adapted;
		},
		remove() {
			popup.remove();
			return adapted;
		},
		removeClassName(name) {
			popup.removeClassName(name);
			return adapted;
		},
		setDOMContent(node) {
			popup.setDOMContent(node);
			return adapted;
		},
		setLngLat(lngLat) {
			popup.setLngLat(lngLat);
			return adapted;
		},
	};
	return adapted;
};
