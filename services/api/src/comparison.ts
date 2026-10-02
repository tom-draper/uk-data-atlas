import type { Measure, PopulationObservation } from "./dataCatalog";

/**
 * Compare two observations in the same measure partition. The caller names
 * both sides so the sign is never implicit: comparison minus baseline.
 */
export const compareObservations = (
	measure: Measure,
	baseline: PopulationObservation,
	comparison: PopulationObservation,
) => {
	const absoluteDifference = comparison.value - baseline.value;
	return {
		baseline,
		comparison,
		difference: {
			direction: "comparison-minus-baseline" as const,
			value: absoluteDifference,
			unit: measure.unit,
			interpretation:
				measure.valueKind === "ratio"
					? "Difference on the source-published ratio scale; do not read it as an aggregate or a percentage change."
					: "Difference in the source-published unit.",
		},
		relativeDifference:
			measure.valueKind === "ratio" || baseline.value === 0
				? null
				: {
						value: absoluteDifference / baseline.value,
						basis: "(comparison - baseline) / baseline",
					},
	};
};
