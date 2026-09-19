import type { BoundaryType } from "@/lib/data/boundaries/catalog";

/** A compact, consistently shaped local-area indicator used by newer sources. */
export interface IndicatorRecord {
	code: string;
	name: string;
	/** The primary published value used by the map and card. */
	value: number;
	/** Other selected, source-exact values that belong with the primary value. */
	metrics?: Record<string, number>;
}

export interface IndicatorDataset<T extends string = string> {
	id: string;
	type: T;
	year: number;
	boundaryType: BoundaryType;
	boundaryYear: number;
	data: Record<string, IndicatorRecord>;
}

export interface AggregatedIndicatorData {
	value: number;
}
