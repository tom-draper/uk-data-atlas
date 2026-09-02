import type { MapManager } from "@/lib/helpers/mapManager/mapManager";
import type { BoundaryType } from "@/lib/types/boundaries";
import type { BoundaryGeojson } from "@/lib/types/geometry";

export interface DatasetSource {
	name: string;
	source: string;
	sourceUrl: string;
	year: string;
	licence: string;
	licenceUrl: string;
	description: string;
}

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
}

export interface DatasetReader {
	text: (path: string) => Promise<string>;
	odsContent: (path: string) => Promise<string>;
	zipCsv: (path: string) => Promise<string>;
}

export interface ChartDefinition<T extends { type: string; data: unknown } = { type: string; data: unknown }> {
	group: string;
	key: string;
	label: string;
	defaultVisible: boolean;
	componentPath: string;
	boundaryType: BoundaryType;
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

export interface ChartDatasetDefinition<T extends { type: string; data: unknown } = { type: string; data: unknown }> {
	type: T["type"];
	precompiledFile: string;
	chart: ChartDefinition<T>;
	charts?: readonly ChartDefinition<T>[];
	source: DatasetSource;
	map?: ChartDatasetMap<T>;
	precompile: (reader: DatasetReader) => Promise<Record<string, T>>;
}

export function getChartDefinitions<T extends { type: string; data: unknown }>(
	definition: ChartDatasetDefinition<T>,
): readonly ChartDefinition<T>[] {
	return definition.charts ?? [definition.chart];
}
