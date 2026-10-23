export const MAP_CONFIG = {
	style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
	center: [-2.3, 53.5] as [number, number],
	zoom: 10,
	maxBounds: [-30, 35, 20, 70] as [number, number, number, number],
	fitBoundsPadding: 40,
	fitBoundsDuration: 1000,
} as const;
