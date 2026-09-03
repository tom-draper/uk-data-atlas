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
	legend?: readonly { label: string; color: string }[];
	layer: Omit<VectorLineLayer, "visibility"> | null;
}
