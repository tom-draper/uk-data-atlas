import type { Dataset } from "@lib/types/datasets";
import type { BoundaryType, BoundaryData } from "@lib/types/boundaries";
import type { BoundaryGeojson } from "@lib/types/geometry";
import { DatasetAggregator } from "./mapManager/statsCalculator";

type BoundaryDataset = Exclude<Dataset, { type: "network" }>;

export interface DatasetConfig<T extends BoundaryDataset> {
	datasets: Record<string, T>;
	boundaryType: BoundaryType;
	keyBy?: "year" | "id";
	calculateStats: (
		aggregator: DatasetAggregator,
		geojson: BoundaryGeojson,
		data: any,
		location: string | null,
		datasetId: string,
		dataset?: T,
	) => any;
}

// Chart sections and the legend often request the same aggregate during one
// render (notably local/general elections and ethnicity). Keying by the stable
// map manager, filtered boundary set, dataset record and location lets them
// share that work without retaining stale data after a location change.
const aggregateCache = new WeakMap<
	DatasetAggregator,
	WeakMap<BoundaryData, WeakMap<object, Map<string, Record<string, any> | null>>>
>();

function cachedAggregate(
	aggregator: DatasetAggregator,
	boundaryData: BoundaryData,
	datasets: object,
	cacheKey: string,
	calculate: () => Record<string, any> | null,
): Record<string, any> | null {
	let boundaryCache = aggregateCache.get(aggregator);
	if (!boundaryCache) {
		boundaryCache = new WeakMap();
		aggregateCache.set(aggregator, boundaryCache);
	}
	let datasetCache = boundaryCache.get(boundaryData);
	if (!datasetCache) {
		datasetCache = new WeakMap();
		boundaryCache.set(boundaryData, datasetCache);
	}
	let entries = datasetCache.get(datasets);
	if (!entries) {
		entries = new Map();
		datasetCache.set(datasets, entries);
	}
	if (entries.has(cacheKey)) return entries.get(cacheKey) ?? null;

	const result = calculate();
	entries.set(cacheKey, result);
	return result;
}

export function aggregateDataset<T extends BoundaryDataset>(
	config: DatasetConfig<T>,
	aggregator: DatasetAggregator | null,
	boundaryData: BoundaryData,
	location: string | null,
): Record<string, any> | null {
	if (Object.keys(config.datasets).length === 0) return null;

	if (!aggregator) return null;

	const cacheKey = `${config.boundaryType}:${config.keyBy ?? "year"}:${location ?? ""}`;
	return cachedAggregate(
		aggregator,
		boundaryData,
		config.datasets,
		cacheKey,
		() => {
			const result: Record<string, any> = {};

			for (const [datasetId, dataset] of Object.entries(config.datasets)) {
				const geojson = boundaryData[config.boundaryType]?.[dataset.boundaryYear];
				const key = config.keyBy === "id" ? datasetId : dataset.year;
				if (dataset.data && geojson) {
					result[key] = config.calculateStats(
						aggregator,
						geojson,
						dataset.data,
						location,
						datasetId,
						dataset,
					);
				} else {
					result[key] = null;
				}
			}

			return result;
		},
	);
}
