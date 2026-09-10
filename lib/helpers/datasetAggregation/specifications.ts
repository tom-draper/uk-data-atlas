import type { BoundaryAggregationSpec } from "./ports";
import { aggregateCustomDataset } from "./economics";

/** Aggregation owned by imported custom boundary datasets. */
export const customDatasetAggregation: BoundaryAggregationSpec<
	Record<string, number>,
	ReturnType<typeof aggregateCustomDataset>
> = {
	cacheKey: "custom-dataset",
	scope: "any",
	aggregate: aggregateCustomDataset,
};
