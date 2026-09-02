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

export interface ScalarDatasetMap {
	valueKey: string;
	colorRange: { min: number; max: number };
	legend: {
		min: number;
		max: number;
		format: (value: number) => string;
	};
}

export interface ScalarDatasetDefinition<T extends { type: string; data: unknown } = { type: string; data: unknown }> {
	type: T["type"];
	precompiledFile: string;
	sourcePath: string;
	chart: {
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
		): unknown | null;
		year: number;
	};
	source: DatasetSource;
	map: ScalarDatasetMap;
	load: (content: string) => Record<string, T>;
}
