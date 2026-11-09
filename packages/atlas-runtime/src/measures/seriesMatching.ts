import type { DimensionalMeasure, Series } from "./dimensionCatalogue.ts";

/**
 * Which series of a measure a set of dimension filters selects. The pure part
 * of reading a request as one series, shared by the API's path routes and
 * `measure=` parameters and by `queryMeasureValues`, so a refusal reads the
 * same wherever it comes from.
 */

/** A filter member that keeps every member of its dimension. */
export const ALL = "*";

/** The datasets a series is read from. */
export const seriesDatasets = (series: Series) =>
	series.datasetId
		? [series.datasetId]
		: [...new Set(series.catalogueMeasure.sources.map((s) => s.datasetId))];

/** Whether two series break a measure down by the same dimensions. */
export const sameShape = (left: Series, right: Series) =>
	Object.keys(left.dimensions).sort().join() ===
		Object.keys(right.dimensions).sort().join() &&
	(left.datasetId ?? "") === (right.datasetId ?? "");

/** What is wrong with a filter, before any series is chosen. */
export type FilterProblem =
	| { kind: "unknown_dimension"; dimension: string }
	| {
			kind: "unknown_member";
			dimension: string;
			unknown: string[];
			members: string[];
	  };

/** The first filter that names a dimension or member the measure lacks. */
export const filterProblem = (
	measure: DimensionalMeasure,
	filters: ReadonlyMap<string, readonly string[]>,
): FilterProblem | undefined => {
	for (const [dimension, codes] of filters) {
		const held = measure.dimensions.find(
			(candidate) => candidate.id === dimension,
		);
		if (!held) return { kind: "unknown_dimension", dimension };
		const unknown = codes.filter(
			(code) =>
				code !== ALL &&
				!held.members.some((member) => member.code === code),
		);
		if (unknown.length > 0)
			return {
				kind: "unknown_member",
				dimension,
				unknown,
				members: held.members.map((member) => member.code),
			};
	}
	return undefined;
};

/**
 * The series of a measure that a set of filters selects, with a dimension left
 * out taking its total. More than one come back where the filters leave it
 * open, and the caller decides whether that is a breakdown or ambiguous.
 */
export const matchingSeries = (
	measure: DimensionalMeasure,
	filters: ReadonlyMap<string, readonly string[]>,
	datasetId: string | undefined,
): Series[] => {
	let candidates = measure.series.filter(
		(series) =>
			[...filters].every(([dimension, codes]) => {
				const code = series.dimensions[dimension];
				return (
					code !== undefined &&
					(codes.includes(ALL) || codes.includes(code))
				);
			}) &&
			(datasetId === undefined ||
				seriesDatasets(series).includes(datasetId)),
	);
	// A dimension left out takes its total, where some series has it.
	for (const dimension of measure.dimensions) {
		if (filters.has(dimension.id) || !dimension.total) continue;
		const totals = candidates.filter(
			(series) =>
				series.dimensions[dimension.id] === undefined ||
				series.dimensions[dimension.id] === dimension.total,
		);
		if (totals.length > 0 && totals.length < candidates.length)
			candidates = totals;
	}
	return candidates;
};

/**
 * Series of different breakdowns, such as households by tenure and by car
 * availability: the measure's reviewed default chooses, if any.
 */
export const preferDefaultBreakdown = (
	measure: DimensionalMeasure,
	candidates: Series[],
): Series[] => {
	const shapes = candidates.filter((series) =>
		sameShape(series, candidates[0]!),
	);
	if (candidates.length > 1 && shapes.length < candidates.length) {
		const preferred = candidates.filter((series) =>
			Object.entries(measure.defaults).every(
				([dimension, code]) => series.dimensions[dimension] === code,
			),
		);
		if (Object.keys(measure.defaults).length > 0 && preferred.length > 0)
			return preferred;
	}
	return candidates;
};
