import type { VectorLineLayer } from "@/lib/helpers/mapManager/layers";

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
	layer: Omit<VectorLineLayer, "visibility"> | null;
}
