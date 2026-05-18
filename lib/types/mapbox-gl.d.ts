// Fallback type declarations for mapbox-gl when the package is not installed.
// When mapbox-gl is installed (npm install mapbox-gl), its bundled types take
// precedence and this file is ignored.
declare module "mapbox-gl" {
	class Map {
		constructor(options: {
			container: HTMLElement;
			style: string;
			center: [number, number];
			zoom: number;
			maxBounds?: [number, number, number, number];
			preserveDrawingBuffer?: boolean;
		});
		remove(): void;
	}

	const mapboxgl: {
		Map: typeof Map;
		accessToken: string;
	};

	export default mapboxgl;
}
