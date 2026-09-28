// The dependencies aggregation needs from its host, stated as structural ports
// so this module never imports from the map layer.
import type { BoundaryType, Features, PropertyKeys } from "@lib/types";

/** A geography to resolve area codes for, or any of them when unknown. */
export type BoundaryCodeScope = BoundaryType | "any";

/**
 * Resolves which boundary property key holds the area code for a geography,
 * or for any geography when the boundary file's own is unknown.
 */
export interface BoundaryCodeDetector {
	detect(scope: BoundaryCodeScope, features: Features): PropertyKeys;
}

/** A dataset-owned recipe for aggregating records over one boundary vintage. */
export interface BoundaryAggregationSpec<T, R> {
	cacheKey: string;
	scope: BoundaryCodeScope;
	aggregate(features: Features, codeProp: PropertyKeys, data: T): R;
	getOrCompute(scope: object, key: string, compute: () => R): R;
}

const MAX_AGGREGATION_RESULTS_PER_SPEC = 64;

/** Create a specification with a result-typed, bounded cache. */
export const createBoundaryAggregationSpec = <T, R>(
	cacheKey: string,
	scope: BoundaryCodeScope,
	aggregate: BoundaryAggregationSpec<T, R>["aggregate"],
): BoundaryAggregationSpec<T, R> => {
	const caches = new WeakMap<object, Map<string, { value: R }>>();
	return {
		cacheKey,
		scope,
		aggregate,
		getOrCompute(scope, key, compute) {
			let cache = caches.get(scope);
			if (!cache) {
				cache = new Map();
				caches.set(scope, cache);
			}
			const cached = cache.get(key);
			if (cached) {
				cache.delete(key);
				cache.set(key, cached);
				return cached.value;
			}

			const value = compute();
			cache.set(key, { value });
			if (cache.size > MAX_AGGREGATION_RESULTS_PER_SPEC)
				cache.delete(cache.keys().next().value!);
			return value;
		},
	};
};
