// Fallback type declarations for the optional Mapbox provider. Keep this
// surface aligned with the methods consumed through MapInstance.
declare module "mapbox-gl" {
	type MapboxPopup = Omit<
		import("./mapInstance").MapPopup,
		"addTo"
	> & {
		addTo(map: import("./mapInstance").MapEngine): MapboxPopup;
	};

	const mapboxgl: {
		Map: new (options: {
			container: HTMLElement;
			style: string;
			center: [number, number];
			zoom: number;
			maxBounds?: [number, number, number, number];
			preserveDrawingBuffer?: boolean;
		}) => import("./mapInstance").MapEngine;
		Popup: new (
			options?: import("./mapInstance").MapPopupOptions,
		) => MapboxPopup;
		accessToken: string;
	};

	export default mapboxgl;
}
