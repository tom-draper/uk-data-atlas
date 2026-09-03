// The dependencies aggregation needs from its host, stated as structural ports
// so this module never imports from the map layer. MapManager's PropertyDetector
// and StatsCache satisfy them as-is.
import { BoundaryType, Features, PropertyKeys } from "@lib/types";

/**
 * Resolves which boundary property key holds the area code for a geography,
 * or for any geography when the boundary file's own is unknown.
 */
export interface BoundaryCodeDetector {
	detect(scope: BoundaryType | "any", features: Features): PropertyKeys;
}

/** Memoises aggregation results across map updates. */
export interface AggregationCache {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
}
