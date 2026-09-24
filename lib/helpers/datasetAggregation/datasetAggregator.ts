// Boundary and cache adapter for dataset-owned aggregation specifications.
import type { BoundaryGeojson } from "@lib/types";
import type {
	BoundaryAggregationSpec,
	BoundaryCodeDetector,
} from "./ports";
import { cacheKey } from "../cacheKey";

/** Aggregates dataset records against the currently loaded boundary geometry. */
export class DatasetAggregator {
	private readonly geometryIds = new WeakMap<BoundaryGeojson, number>();
	private nextGeometryId = 0;

	constructor(
		private propertyDetector: BoundaryCodeDetector,
	) {}

	private geometryId(geojson: BoundaryGeojson): number {
		const cached = this.geometryIds.get(geojson);
		if (cached !== undefined) return cached;
		const id = this.nextGeometryId++;
		this.geometryIds.set(geojson, id);
		return id;
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
		return spec.getOrCompute(
			this,
			cacheKey(
				this.geometryId(geojson),
				spec.cacheKey,
				location,
				datasetId,
			),
			() => {
				const features = geojson.features;
				const codeProp = this.propertyDetector.detect(
					spec.scope,
					features,
				);
				return spec.aggregate(features, codeProp, data);
			},
		);
	}
}
