const MAPBOX_CONFIG = {
	style: "mapbox://styles/mapbox/light-v11",
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	maxBounds: [-30, 35, 20, 70] as [number, number, number, number],
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
} as const;

const MAPLIBRE_CONFIG = {
	style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	maxBounds: [-30, 35, 20, 70] as [number, number, number, number],
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
} as const;

// NEXT_PUBLIC_MAP_PROVIDER is "maplibre" or "mapbox"; see next.config.ts.
export const MAP_CONFIG =
	process.env.NEXT_PUBLIC_MAP_PROVIDER === "mapbox"
		? MAPBOX_CONFIG
		: MAPLIBRE_CONFIG;

export { MAPBOX_CONFIG, MAPLIBRE_CONFIG };
