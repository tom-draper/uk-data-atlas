import type { DatasetAggregator } from "@/lib/helpers/datasetAggregation";
import type { MapRenderContext } from "@/lib/helpers/mapRendering";
import type { ActiveViz, VizView } from "@/lib/types/datasets";
import type { BoundaryGeojson, DatasetTopic } from "@uk-data-atlas/datasets";
import type { MapOptions } from "@/lib/types/mapOptions";
import type { ComponentType } from "react";
import type { ChartComponentProps } from "@/components/chartComponentTypes";
import type { DatasetDefinition } from "../data/catalog";
import type { DeprivationCardConfig } from "./deprivationCard";
import type { BarsCardConfig } from "@/lib/measures/barsConfig";
import type { BreakdownCardConfig } from "@/lib/measures/breakdownConfig";
import type { SeriesCardConfig } from "@/lib/measures/seriesConfig";
import type { ValueCardConfig } from "./valueCard";

/**
 * A client-side adapter from the generic chart-card pipeline to one chart
 * component's dataset-specific props.
 */
export type ChartPresentation = {
	component: ComponentType<ChartComponentProps>;
};

export type ChartPresentationRegistry = Record<string, ChartPresentation>;

// Only meaningful for datasets rendered as a colour-range choropleth on the
// map. Categorical datasets (party winner, majority ethnicity, ...) render
// through their own bespoke map path and leave this unset.
export interface ChartDatasetMap<T = unknown> {
	valueKey?: string;
	valueFor?(dataset: T, code: string, mapOptions: MapOptions): number | null;
	/** Identifies option-dependent source values for the transformed GeoJSON cache. */
	sourceMode?(dataset: T, mapOptions: MapOptions): string;
	colorRange: { min: number; max: number };
	legend: {
		bounds?(options: MapOptions): { min: number; max: number };
		min: number;
		max: number;
		format: (value: number, mapOptions: MapOptions) => string;
	};
	// Most datasets colour low->high as high->low on the theme gradient
	// (matches updateGenericMap's default). Rank-based datasets, where a
	// low rank means "most deprived", set this false to flip that.
	invertColor?: boolean;
	// Provides the data-derived range used until a visitor adjusts the shared
	// colour-range control. This keeps datasets with different natural scales
	// useful on first load without disabling the legend handles.
	getColorRange?(
		dataset: T,
		mapOptions: MapOptions,
	): { min: number; max: number };
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
	/** The dataset's topic, which places the card under its theme. */
	topic: DatasetTopic;
	key: string;
	label: string;
	componentPath: string;
	/** A chart drawn from measure queries needs no aggregate of its own. */
	calculateStats?(
		aggregator: DatasetAggregator,
		geojson: BoundaryGeojson,
		data: T["data"],
		location: string | null,
		datasetId: string,
		dataset?: T,
	): unknown | null;
	year: number;
	/** The map view this chart selects, when one dataset backs several charts. */
	view?: VizView;
	// Set when a dataset's records are keyed by an id (e.g. "le" / "hle")
	// rather than by year, such as one dataset backing several fixed charts.
	datasetId?: string;
	keyBy?: "year" | "id";
	// Declares the card for charts rendered by the shared value card
	// (`@/components/ValueCard`) rather than a component of their own.
	card?: ValueCardConfig;
	cardForOptions?(options: MapOptions): ValueCardConfig;
	// Declares the history card for charts rendered by the shared series
	// chart (`@/components/measures/MeasureSeriesChart`).
	seriesForOptions?(options: MapOptions): SeriesCardConfig;
	// Declares the breakdown card for charts rendered by the shared breakdown
	// chart (`@/components/measures/MeasureBreakdownChart`).
	breakdown?: BreakdownCardConfig;
	// Declares the bars card for charts rendered by the shared bars chart
	// (`@/components/measures/MeasureBarsChart`).
	bars?: BarsCardConfig;
	// Declares the deprivation card for charts rendered by the shared
	// deprivation chart (`@/components/measures/MeasureDeprivationChart`).
	deprivation?: DeprivationCardConfig;
}

export type ChartDatasetLegendAggregation<
	T extends { type: string; data: unknown },
> = Required<Pick<ChartDefinition<T>, "calculateStats">> &
	Pick<ChartDefinition<T>, "keyBy">;

export type ChartDatasetLegendKind = "party" | "category" | "brexit";

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
