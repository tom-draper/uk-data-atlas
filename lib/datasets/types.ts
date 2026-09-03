import type { DatasetAggregator } from "@/lib/helpers/datasetAggregation";
import type { MapRenderContext } from "@/lib/helpers/mapRendering";
import type { ActiveViz } from "@/lib/types/datasets";
import type { BoundaryGeojson } from "@/lib/types/geometry";
import type { MapOptions } from "@/lib/types/mapOptions";
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

/** Presentation-specific renderer for datasets that cannot use the shared numeric map path. */
export interface ChartDatasetMapRenderer<
	T extends { type: string; data: unknown },
> {
	getOptions(activeViz: ActiveViz, mapOptions: MapOptions): object;
	// Renderers paint through the map context, not the map session itself, so a
	// dataset definition cannot reach the wider MapManager surface.
	render(context: {
		map: MapRenderContext;
		geojson: BoundaryGeojson;
		dataset: T;
		mapOptions: MapOptions;
		activeViz: ActiveViz;
		isDark: boolean;
	}): void;
}

export interface ChartDefinition<
	T extends { type: string; data: unknown } = { type: string; data: unknown },
> {
	group: string;
	key: string;
	label: string;
	defaultVisible: boolean;
	componentPath: string;
	calculateStats(
		aggregator: DatasetAggregator,
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

export type ChartDatasetLegendAggregation<
	T extends { type: string; data: unknown },
> = Pick<ChartDefinition<T>, "calculateStats" | "keyBy">;

export type ChartDatasetLegendKind =
	"population" | "party" | "ethnicity" | "brexit";

export interface ChartDatasetDefinition<
	T extends { type: string; data: unknown } = { type: string; data: unknown },
> extends DatasetDefinition<T> {
	chart: ChartDefinition<T>;
	charts?: readonly ChartDefinition<T>[];
	map?: ChartDatasetMap<T>;
	mapRenderer?: ChartDatasetMapRenderer<T>;
	legendAggregation?: ChartDatasetLegendAggregation<T>;
	legendKind?: ChartDatasetLegendKind;
}

export function getChartDefinitions<T extends { type: string; data: unknown }>(
	definition: ChartDatasetDefinition<T>,
): readonly ChartDefinition<T>[] {
	return definition.charts ?? [definition.chart];
}
