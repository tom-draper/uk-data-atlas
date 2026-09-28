import type { MapExpression, PaintValue } from "./mapExpression";

/** A map-native vector-tile layer before view-specific visibility is applied. */
export interface NetworkVectorLayer {
	kind: "vector-line";
	id: string;
	source: {
		tiles: string[];
		sourceLayer: string;
		minzoom?: number;
		maxzoom?: number;
		attribution?: string;
	};
	style: {
		color: PaintValue<string>;
		width: PaintValue<number>;
		opacity?: number;
	};
	/** Tile attribute a legend-driven filter matches against. */
	filterProperty?: string;
	filter?: MapExpression;
}

/** A map-native dataset whose geometry is streamed as vector tiles. */
export interface NetworkDataset {
	id: string;
	type: "network";
	kind: "vector-lines";
	name: string;
	year: number;
	dataColumn: string;
	provider: string;
	licence: string;
	description: string;
	available: boolean;
	legend?: readonly {
		id: string;
		label: string;
		color: string;
		/** Tile attribute values this row matches; omit for a catch-all "other" row. */
		values?: readonly string[];
	}[];
	layer: NetworkVectorLayer | null;
}
