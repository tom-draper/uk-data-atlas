import type { Dataset } from "@lib/types/datasets";
import type { BoundaryType, BoundaryData } from "@lib/types/boundaries";
import type { BoundaryGeojson } from "@lib/types/geometry";
import { MapManager } from "./mapManager/mapManager";

export interface DatasetConfig<T extends Dataset> {
	datasets: Record<string, T>;
	boundaryType: BoundaryType;
	keyBy?: "year" | "id";
	calculateStats: (
		mapManager: MapManager,
		geojson: BoundaryGeojson,
		data: any,
		location: string | null,
		datasetId: string,
	) => any;
}

export function aggregateDataset<T extends Dataset>(
	config: DatasetConfig<T>,
	mapManager: MapManager | null,
	boundaryData: BoundaryData,
	location: string | null,
): Record<string, any> | null {
	if (!mapManager) return null;
	if (Object.keys(config.datasets).length === 0) return null;

	const result: Record<string, any> = {};

	for (const [datasetId, dataset] of Object.entries(config.datasets)) {
		const geojson = boundaryData[config.boundaryType]?.[dataset.boundaryYear];
		const key = config.keyBy === "id" ? datasetId : dataset.year;
		if (dataset.data && geojson) {
			result[key] = config.calculateStats(
				mapManager,
				geojson,
				dataset.data,
				location,
				datasetId,
			);
		} else {
			result[key] = null;
		}
	}

	return result;
}
