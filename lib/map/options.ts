export interface MapInitializationOptions {
	style: string;
	center: [number, number];
	zoom: number;
	maxBounds: [number, number, number, number];
	initialBounds?: [number, number, number, number];
	fitBoundsPadding?: number;
}
