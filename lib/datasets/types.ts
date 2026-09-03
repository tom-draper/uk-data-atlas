import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import type { BoundaryGeojson } from "@/lib/types/geometry";
import type { DatasetDefinition } from "../data/catalog";

// Only meaningful for datasets rendered as a colour-range choropleth on the
// map. Categorical datasets (party winner, majority ethnicity, ...) render
// through their own bespoke map path and leave this unset.
export interface ChartDatasetMap<T = unknown> {
	valueKey?: string;
	valueFor?(dataset: T, code: string): number | null;
	colorRange: { min: number; max: number };
	legend: {
		min: number;
		max: number;
		format: (value: number) => string;
	};
	// Most datasets colour low->high as high->low on the theme gradient
	// (matches updateGenericMap's default). Rank-based datasets, where a
	// low rank means "most deprived", set this false to flip that.
	invertColor?: boolean;
	// Overrides `colorRange` on the map with a range computed from the
	// dataset itself, for datasets whose scale isn't a fixed, user-tunable
	// range (e.g. life expectancy's years, which just spans whatever the
	// current data covers).
	getColorRange?(dataset: T): { min: number; max: number };
}

export interface ChartDefinition<T extends { type: string; data: unknown } = { type: string; data: unknown }> {
	group: string;
	key: string;
	label: string;
	defaultVisible: boolean;
	componentPath: string;
	calculateStats(
		mapManager: MapManager,
		geojson: BoundaryGeojson,
		data: T["data"],
		location: string | null,
		datasetId: string,
		dataset?: T,
	): unknown | null;
	year: number;
	// Set when a dataset's records are keyed by an id (e.g. "le" / "hle")
	// rather than by year, such as one dataset backing several fixed charts.
	datasetId?: string;
	keyBy?: "year" | "id";
}

export interface ChartDatasetDefinition<T extends { type: string; data: unknown } = { type: string; data: unknown }>
	extends DatasetDefinition<T> {
	chart: ChartDefinition<T>;
	charts?: readonly ChartDefinition<T>[];
	map?: ChartDatasetMap<T>;
}

export function getChartDefinitions<T extends { type: string; data: unknown }>(
	definition: ChartDatasetDefinition<T>,
): readonly ChartDefinition<T>[] {
	return definition.charts ?? [definition.chart];
}
