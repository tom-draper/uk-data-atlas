import { type Indicator, publishIndicators } from "./indicators";
import type { CatalogManifest, CompiledMeasure } from "./manifest";

/** Households and children in temporary accommodation, by English authority. */
export const compileHomelessness = (
	manifest: CatalogManifest,
	homelessnessPath: string,
	england2025: string[],
): CompiledMeasure[] => {
	const inTemporaryAccommodation = (
		id: string,
		label: string,
		field: string,
		unit: string,
		note: string,
	): Indicator => ({
		id,
		label,
		field,
		valueKind: "count",
		unit,
		aggregation: { kind: "extensive", operation: "sum", available: true },
		notes: [note],
	});
	return publishIndicators(manifest, {
		datasetId: "homelessness",
		path: homelessnessPath,
		boundaryYear: 2025,
		period: "2026-Q1",
		expectedCodes: england2025,
		coverageNote:
			"Published source records cover English authorities only; an authority that did not submit a return for the quarter has no value rather than zero.",
		notes: [
			"Households placed in temporary accommodation by the authority under homelessness legislation, at the end of January to March 2026. A household is counted by the authority that placed it, which may house it in another area.",
			"The published rate per thousand households is not served: a rate does not add over areas and would need the number of households as a weight.",
		],
		indicators: [
			inTemporaryAccommodation(
				"temporary-accommodation-households",
				"Households in temporary accommodation",
				"householdsInTemporaryAccommodation",
				"households",
				"Every household in temporary accommodation, with or without children.",
			),
			inTemporaryAccommodation(
				"temporary-accommodation-households-with-children",
				"Households with children in temporary accommodation",
				"householdsWithChildren",
				"households",
				"Households with dependent children, a subset of all households in temporary accommodation.",
			),
			inTemporaryAccommodation(
				"temporary-accommodation-children",
				"Children in temporary accommodation",
				"childrenInTemporaryAccommodation",
				"children",
				"Dependent children living in those households, counted as people rather than households.",
			),
		],
	});
};
