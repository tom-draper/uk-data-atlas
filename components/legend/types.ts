import type { EthnicityCode, MapOptions, PartyCode } from "@/lib/types";
import type { ColorRangeMapOptionKey } from "@/lib/types/mapOptions";

export type PartyDisplayData = { id: PartyCode; color: string; name: string };

export type EthnicityDisplayData = {
	id: EthnicityCode;
	color: string;
	name: string;
};

export type ColorRangeDatasetKey = ColorRangeMapOptionKey;

export type LegendAggregates = Record<string, Record<string, unknown> | null>;

export type MapOptionsChangeHandler = (
	type: keyof MapOptions,
	options: Partial<MapOptions[typeof type]>,
) => void;
