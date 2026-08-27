export type ChartAggregateKey = "year" | "id";

/**
 * Build-time aggregates used by the chart panel when no individual area is
 * selected. Raw datasets and boundary geometry are still eagerly loaded for
 * maps, hover interactions and drill-downs; this index only avoids repeating
 * the same whole-location reductions in the browser.
 */
export interface ChartSummaryIndex {
  version: 1;
  locations: Record<
    string,
    Record<string, Partial<Record<ChartAggregateKey, Record<string, unknown>>>>
  >;
}
