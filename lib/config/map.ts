
export const DEFAULT_MAP_TYPE = 'maplibre';

const MAP_TYPE = (process.env.NEXT_PUBLIC_MAP_TYPE || DEFAULT_MAP_TYPE).toLowerCase();

const MAPBOX_CONFIG = {
	style: 'mapbox://styles/mapbox/light-v11',
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	maxBounds: [-30, 35, 20, 70] as [number, number, number, number],
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
} as const;

const MAPLIBRE_CONFIG = {
	style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	maxBounds: [-30, 35, 20, 70] as [number, number, number, number],
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
} as const;

export const MAP_CONFIG = MAP_TYPE === 'mapbox' ? MAPBOX_CONFIG : MAPLIBRE_CONFIG;

export { MAP_TYPE, MAPBOX_CONFIG, MAPLIBRE_CONFIG };