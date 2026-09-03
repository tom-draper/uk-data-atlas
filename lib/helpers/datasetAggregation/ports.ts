// The dependencies aggregation needs from its host, stated as structural ports
// so this module never imports from the map layer. MapManager's PropertyDetector
// and StatsCache satisfy them as-is.
import { BoundaryType, Features, PropertyKeys } from "@lib/types";

/** A geography to resolve area codes for, or any of them when unknown. */
export type BoundaryCodeScope = BoundaryType | "any";

/**
 * Resolves which boundary property key holds the area code for a geography,
 * or for any geography when the boundary file's own is unknown.
 */
export interface BoundaryCodeDetector {
	detect(scope: BoundaryCodeScope, features: Features): PropertyKeys;
}

/** Memoises aggregation results across map updates. */
export interface AggregationCache {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
}
