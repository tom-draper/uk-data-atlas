// The dependencies aggregation needs from its host, stated as structural ports
// so this module never imports from the map layer. MapManager's PropertyDetector
// and StatsCache satisfy them as-is.
import { Features, PropertyKeys } from "@lib/types";

/** Resolves which boundary property key holds each kind of area code. */
export interface BoundaryCodeDetector {
	detectWardCode(features: Features): PropertyKeys;
	detectConstituencyCode(features: Features): PropertyKeys;
	detectLocalAuthorityCode(features: Features): PropertyKeys;
	detectLSOACode(features: Features): PropertyKeys;
	detectDataZoneCode(features: Features): PropertyKeys;
	detectSOACode(features: Features): PropertyKeys;
	detectCode(features: Features): PropertyKeys;
}

/** Memoises aggregation results across map updates. */
export interface AggregationCache {
	get(key: string): unknown;
	set(key: string, value: unknown): void;
}
