import type { Dataset } from "@lib/types/datasets";
import type { BoundaryType, BoundaryData } from "@lib/types/boundaries";
import type { BoundaryGeojson } from "@lib/types/geometry";
import { DatasetAggregator } from "./datasetAggregation";

type BoundaryDataset = Exclude<Dataset, { type: "network" }>;
type Aggregate = Record<string, unknown> | null;

export interface DatasetConfig<T extends BoundaryDataset, R = unknown> {
	datasets: Record<string, T>;
	boundaryType: BoundaryType;
	keyBy?: "year" | "id";
	calculateStats: (
		aggregator: DatasetAggregator,
		geojson: BoundaryGeojson,
		data: T["data"],
		location: string | null,
		datasetId: string,
		dataset?: T,
	) => R | null;
}

// Chart sections and the legend often request the same aggregate during one
// render (notably local/general elections and ethnicity). Keying by the stable
// map manager, filtered boundary set, dataset record and location lets them
// share that work without retaining stale data after a location change.
const aggregateCache = new WeakMap<
	DatasetAggregator,
	WeakMap<BoundaryData, WeakMap<object, Map<string, Aggregate>>>
>();

// Dataset ids are stable across locations, whereas each worker response has a
// distinct data object. Include that identity in the aggregator cache key so a
// temporary aggregate against the previous location's slice cannot be reused
// after the matching slice arrives.
const dataCacheIds = new WeakMap<object, number>();
let nextDataCacheId = 0;

const cacheDatasetId = (datasetId: string, dataset: object) => {
	const data = Reflect.get(dataset, "data");
	const identity = data && typeof data === "object" ? data : dataset;
	let id = dataCacheIds.get(identity);
	if (id === undefined) {
		id = nextDataCacheId++;
		dataCacheIds.set(identity, id);
	}
	return `${datasetId}:${id}`;
};

function cachedAggregate<R>(
	aggregator: DatasetAggregator,
	boundaryData: BoundaryData,
	datasets: object,
	cacheKey: string,
	calculate: () => Record<string, R | null>,
): Record<string, R | null> {
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
	if (entries.has(cacheKey))
		return entries.get(cacheKey) as Record<string, R | null>;

	const result = calculate();
	entries.set(cacheKey, result);
	return result;
}

export function aggregateDataset<T extends BoundaryDataset, R>(
	config: DatasetConfig<T, R>,
	aggregator: DatasetAggregator | null,
	boundaryData: BoundaryData,
	location: string | null,
): Record<string, R | null> | null {
	if (Object.keys(config.datasets).length === 0) return null;
	const precomputed: Record<string, R | null> = {};
	for (const [datasetId, dataset] of Object.entries(config.datasets)) {
		const aggregate = Reflect.get(dataset, "locationAggregate");
		if (aggregate !== undefined) {
			const key = config.keyBy === "id" ? datasetId : dataset.year;
			precomputed[key] = aggregate as R;
		}
	}
	if (Object.keys(precomputed).length === Object.keys(config.datasets).length)
		return precomputed;

	if (!aggregator)
		return Object.keys(precomputed).length ? precomputed : null;

	const cacheKey = `${config.boundaryType}:${config.keyBy ?? "year"}:${location ?? ""}`;
	return cachedAggregate(
		aggregator,
		boundaryData,
		config.datasets,
		cacheKey,
		() => {
			const result: Record<string, R | null> = {};

			for (const [datasetId, dataset] of Object.entries(
				config.datasets,
			)) {
				const geojson =
					boundaryData[config.boundaryType]?.[dataset.boundaryYear];
				const key = config.keyBy === "id" ? datasetId : dataset.year;
				const precomputedAggregate = Reflect.get(
					dataset,
					"locationAggregate",
				);
				if (precomputedAggregate !== undefined) {
					result[key] = precomputedAggregate as R;
					continue;
				}
				if (dataset.data && geojson) {
					result[key] = config.calculateStats(
						aggregator,
						geojson,
						dataset.data,
						location,
						cacheDatasetId(datasetId, dataset),
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
