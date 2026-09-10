// Boundary and cache adapter for dataset-owned aggregation specifications.
import type { BoundaryGeojson, Features, PropertyKeys } from "@lib/types";
import type {
	AggregationCache,
	BoundaryAggregationSpec,
	BoundaryCodeDetector,
	BoundaryCodeScope,
} from "./ports";

/** Aggregates dataset records against the currently loaded boundary geometry. */
export class DatasetAggregator {
	constructor(
		private propertyDetector: BoundaryCodeDetector,
		private cache: AggregationCache,
	) {}

	// Cache empty-coverage results too, so they are not recomputed on every update.
	private cached<R>(cacheKey: string, compute: () => R): R {
		const cached = this.cache.get(cacheKey);
		if (cached !== undefined) return cached as R;
		const result = compute();
		this.cache.set(cacheKey, result);
		return result;
	}

	private byBoundary<R>(
		key: string,
		scope: BoundaryCodeScope,
		geojson: BoundaryGeojson,
		location: string | null,
		datasetId: string | null,
		aggregate: (features: Features, codeProp: PropertyKeys) => R,
	): R {
		return this.cached(`${key}-${location}-${datasetId}`, () =>
			aggregate(
				geojson.features,
				this.propertyDetector.detect(scope, geojson.features),
			),
		);
	}

	/**
	 * Run a dataset-owned aggregation specification through the shared boundary
	 * code detection and cache. Adding a dataset no longer expands this class.
	 */
	aggregate<T, R>(
		spec: BoundaryAggregationSpec<T, R>,
		geojson: BoundaryGeojson,
		data: T,
		location: string | null,
		datasetId: string | null,
	): R {
		return this.byBoundary(
			spec.cacheKey,
			spec.scope,
			geojson,
			location,
			datasetId,
			(features, codeProp) => spec.aggregate(features, codeProp, data),
		);
	}
}
