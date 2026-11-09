import type { Measure, MeasureSource } from "./index.ts";

export type SourceQuery = {
	period?: string | null;
	geography?: string | null;
	boundaryYear?: string | null;
	datasetId?: string | null;
};

export type DefaultedSource = {
	source: MeasureSource;
	period: string;
	geography: string;
	boundaryYear: string;
	/** Parameters the caller omitted and the route selected deliberately. */
	defaulted: Record<string, string | number>;
};

/**
 * Select the current source partition without making catalogue order part of
 * the public API.  A newer source-boundary vintage wins; within it the source's
 * last declared period wins.  Two datasets on that same current partition are
 * intentionally left ambiguous, so callers still have to name datasetId.
 */
export const defaultSource = (
	measure: Pick<Measure, "sources">,
	query: SourceQuery,
	periods: string[] = query.period ? [query.period] : [],
	includePeriod = true,
): DefaultedSource | undefined => {
	const candidates = measure.sources.filter(
		(source) =>
			(query.geography == null ||
				source.sourceGeography.type === query.geography) &&
			(query.boundaryYear == null ||
				String(source.sourceGeography.boundaryYear) ===
					query.boundaryYear) &&
			(query.datasetId == null || source.datasetId === query.datasetId) &&
			periods.every((period) => source.periods.includes(period)),
	);
	if (candidates.length === 0) return undefined;
	// Geographies are not newer or older than one another: a ranking of
	// constituencies is no more current than one of local authorities. So
	// the geography is chosen only when the measure leaves no choice.
	if (
		query.geography == null &&
		new Set(candidates.map((source) => source.sourceGeography.type)).size >
			1
	)
		return undefined;
	const newestYear = Math.max(
		...candidates.map((source) => source.sourceGeography.boundaryYear),
	);
	const current = candidates.filter(
		(source) => source.sourceGeography.boundaryYear === newestYear,
	);
	// More than one data product can legitimately share a geography and source
	// vintage.  It is not safe to choose one merely because it happened to be
	// listed first in the catalogue.
	if (
		query.datasetId == null &&
		new Set(current.map((source) => source.datasetId)).size > 1
	)
		return undefined;
	const source = current[0]!;
	const period = query.period ?? source.periods.at(-1);
	if (!period) return undefined;
	return {
		source,
		period,
		geography: source.sourceGeography.type,
		boundaryYear: String(source.sourceGeography.boundaryYear),
		defaulted: {
			...(includePeriod && query.period == null ? { period } : {}),
			...(query.geography == null
				? { geography: source.sourceGeography.type }
				: {}),
			...(query.boundaryYear == null
				? { boundaryYear: source.sourceGeography.boundaryYear }
				: {}),
		},
	};
};

/** Each partition a measure publishes, for a refusal that asks for one. */
export const publishedPartitions = (measure: Pick<Measure, "sources">) =>
	measure.sources
		.map(
			(source) =>
				`geography=${source.sourceGeography.type}&codeYear=${source.sourceGeography.boundaryYear} (${source.periods.length} period${source.periods.length === 1 ? "" : "s"})`,
		)
		.join("; ");
