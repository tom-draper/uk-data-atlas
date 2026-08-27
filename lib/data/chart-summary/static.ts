import summaryJson from "@/data/precompiled/chart-summaries.json";
import type { ChartAggregateKey, ChartSummaryIndex } from "./types";

const chartSummaries = summaryJson as ChartSummaryIndex;

export const getChartSummary = (
  location: string | null,
  datasetType: string | undefined,
  keyBy: ChartAggregateKey,
): Record<string, unknown> | null => {
  if (!location || !datasetType) return null;
  return chartSummaries.locations[location]?.[datasetType]?.[keyBy] ?? null;
};
