/**
 * Dataset aggregation is independent of MapLibre rendering: the map layer
 * depends on this module, never the reverse. This is its public entry point,
 * while the implementation is split by domain.
 */
export { DatasetAggregator } from "./datasetAggregator";
export type { AggregationCache, BoundaryCodeDetector } from "./ports";
