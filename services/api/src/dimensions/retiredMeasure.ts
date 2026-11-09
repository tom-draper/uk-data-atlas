import { problem } from "@uk-data-atlas/atlas-runtime/api";
import type {
	DimensionalMeasure,
	Series,
} from "@uk-data-atlas/atlas-runtime/measures";

/** Explain how to replace a retired public series id. */
export const retiredMeasure = (
	id: string,
	measure: DimensionalMeasure,
	series: Series,
) => {
	const members = Object.entries(series.dimensions)
		.map(([dimension, member]) => `${dimension}=${member}`)
		.join(", ");
	const dataset = series.datasetId ? `datasetId=${series.datasetId}` : "";
	const filters = [members, dataset].filter(Boolean).join(", ");
	return problem(
		404,
		"Not Found",
		`${id} is no longer accepted. Use /v1/data/${measure.id}${filters ? ` with ${filters}` : ""}.`,
		{
			code: "retired_measure_id",
			measure: measure.id,
			members: series.dimensions,
		},
	);
};
