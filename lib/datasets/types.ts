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

export interface ScalarDatasetMap<T = unknown> {
	valueKey?: string;
	valueFor?(dataset: T, code: string): number | null;
	colorRange: { min: number; max: number };
	legend: {
		min: number;
		max: number;
		format: (value: number) => string;
	};
}

export interface ScalarDatasetReader {
	text: (path: string) => Promise<string>;
	odsContent: (path: string) => Promise<string>;
	zipCsv: (path: string) => Promise<string>;
}

export interface ScalarChartDefinition<T extends { type: string; data: unknown } = { type: string; data: unknown }> {
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
}

export interface ScalarDatasetDefinition<T extends { type: string; data: unknown } = { type: string; data: unknown }> {
	type: T["type"];
	precompiledFile: string;
	chart: ScalarChartDefinition<T>;
	charts?: readonly ScalarChartDefinition<T>[];
	source: DatasetSource;
	map: ScalarDatasetMap<T>;
	precompile: (reader: ScalarDatasetReader) => Promise<Record<string, T>>;
}

export function getChartDefinitions<T extends { type: string; data: unknown }>(
	definition: ScalarDatasetDefinition<T>,
): readonly ScalarChartDefinition<T>[] {
	return definition.charts ?? [definition.chart];
}
