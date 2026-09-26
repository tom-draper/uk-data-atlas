import type { Dataset } from "@lib/types/datasets";
import type { BoundaryType, BoundaryData } from "@lib/types/boundaries";
import type { BoundaryGeojson } from "@lib/types/geometry";
import { DatasetAggregator } from "./datasetAggregation";
import { cacheKey } from "./cacheKey";

type BoundaryDataset = Exclude<Dataset, { type: "network" }>;
type AggregateResult<R> = Record<string, R | null>;

export interface DatasetConfig<T extends BoundaryDataset, R = unknown> {
	datasets: Record<string, T>;
	boundaryType: BoundaryType;
	keyBy?: "year" | "id";
	/** Reads a precomputed aggregate when this dataset includes one. */
	getLocationAggregate?: (dataset: T) => R | null | undefined;
	calculateStats: (
		aggregator: DatasetAggregator,
		geojson: BoundaryGeojson,
		data: T["data"],
		location: string | null,
		datasetId: string,
		dataset?: T,
	) => R | null;
	/** @internal Cache retained by callers that reuse this configuration. */
	aggregateCache?: Map<string, { result: AggregateResult<R> }>;
}

const CACHE_LIMIT = 1000;
const cacheObjectIds = new WeakMap<object, number>();
let nextCacheObjectId = 0;

const cacheObjectId = (value: object): number => {
	let id = cacheObjectIds.get(value);
	if (id === undefined) {
		id = nextCacheObjectId++;
		cacheObjectIds.set(value, id);
	}
	return id;
};

// Dataset ids are stable across locations, whereas each worker response has a
// distinct data object. Include that identity in the aggregator cache key so a
// temporary aggregate against the previous location's slice cannot be reused
// after the matching slice arrives.
const dataCacheIds = new WeakMap<object, number>();
let nextDataCacheId = 0;

const cacheDatasetId = (datasetId: string, dataset: object, data: unknown) => {
	const identity = data && typeof data === "object" ? data : dataset;
	let id = dataCacheIds.get(identity);
	if (id === undefined) {
		id = nextDataCacheId++;
		dataCacheIds.set(identity, id);
	}
	return cacheKey(datasetId, id);
};

export function aggregateDataset<T extends BoundaryDataset, R>(
	config: DatasetConfig<T, R>,
	aggregator: DatasetAggregator | null,
	boundaryData: BoundaryData,
	location: string | null,
): Record<string, R | null> | null {
	if (Object.keys(config.datasets).length === 0) return null;
	const precomputed: Record<string, R | null> = {};
	for (const [datasetId, dataset] of Object.entries(config.datasets)) {
		const aggregate = config.getLocationAggregate?.(dataset);
		if (aggregate !== undefined) {
			const key = config.keyBy === "id" ? datasetId : dataset.year;
			precomputed[key] = aggregate;
		}
	}
	if (Object.keys(precomputed).length === Object.keys(config.datasets).length)
		return precomputed;

	if (!aggregator)
		return Object.keys(precomputed).length ? precomputed : null;

	const aggregationKey = cacheKey(
		config.boundaryType,
		config.keyBy ?? "year",
		location,
		cacheObjectId(aggregator),
		cacheObjectId(boundaryData),
		cacheObjectId(config.datasets),
		cacheObjectId(config.calculateStats),
		config.getLocationAggregate
			? cacheObjectId(config.getLocationAggregate)
			: "no-precomputed-aggregate",
	);
	const cache = (config.aggregateCache ??= new Map());
	const cached = cache.get(aggregationKey);
	if (cached) return cached.result;

	const result: AggregateResult<R> = {};
	for (const [datasetId, dataset] of Object.entries(config.datasets)) {
		const geojson =
			boundaryData[config.boundaryType]?.[dataset.boundaryYear];
		const key = config.keyBy === "id" ? datasetId : dataset.year;
		const precomputedAggregate = config.getLocationAggregate?.(dataset);
		if (precomputedAggregate !== undefined) {
			result[key] = precomputedAggregate;
			continue;
		}
		if (dataset.data && geojson) {
			result[key] = config.calculateStats(
				aggregator,
				geojson,
				dataset.data,
				location,
				cacheDatasetId(datasetId, dataset, dataset.data),
				dataset,
			);
		} else {
			result[key] = null;
		}
	}
	cache.set(aggregationKey, { result });
	if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
	return result;
}
