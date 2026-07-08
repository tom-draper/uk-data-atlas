import { BoundaryType } from "./boundaries";

export interface CustomPoint {
	lng: number;
	lat: number;
	value: number;
	label?: string;
}

export interface CustomDataset {
	id: string;
	type: "custom";
	// "choropleth": values keyed by boundary code, painted on boundary polygons.
	// "points": values at lat/lng locations, painted as markers.
	kind: "choropleth" | "points";
	name: string;
	year: number;
	boundaryType: BoundaryType;
	boundaryYear: number;
	dataColumn: string;
	// Populated for choropleth datasets (boundary code → value).
	data: { [key: string]: number };
	// Populated for point datasets.
	points?: CustomPoint[];
	valueMin?: number;
	valueMax?: number;
}

export type AggregatedCustomData = {
	average: number;
	count: number;
};
