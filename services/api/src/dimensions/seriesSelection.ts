import {
	invalidQuery,
	problem,
	type ApiResponse,
	type RouteDispatchContext,
} from "../runtime/index.ts";
import { measureSlug } from "@uk-data-atlas/catalogue";
import { type DataCatalog } from "@uk-data-atlas/catalogue/node";
import {
	ALL,
	filterProblem,
	matchingSeries,
	preferDefaultBreakdown,
	sameShape,
	seriesDatasets,
} from "@uk-data-atlas/measures";
import { canonicalMeasureId } from "../catalogue/measureTerms";
import type {
	DimensionCatalogue,
	DimensionalMeasure,
	Series,
} from "@uk-data-atlas/measures";

/**
 * How a measure, and the dimension filters that go with it, are read as one
 * series. The path routes and the `measure` query parameter share it, so both
 * refuse an unknown dimension or member in the same words.
 */

export { ALL, sameShape, seriesDatasets };

export type DimensionContext = Pick<
	RouteDispatchContext,
	"dataCatalog" | "measureDimensions"
> & {
	geographyResolver?: Pick<
		RouteDispatchContext["geographyResolver"],
		"places"
	>;
};

/** The dimension filters a query carries, by dimension id. */
export const readFilters = (
	searchParams: URLSearchParams,
	dimensionIds: ReadonlySet<string>,
) => {
	const filters = new Map<string, string[]>();
	const names: string[] = [];
	for (const [name, value] of searchParams) {
		const nested = /^dimensions\[([^\]]+)\]$/.exec(name)?.[1];
		const dimension = nested ?? (dimensionIds.has(name) ? name : undefined);
		if (!dimension) continue;
		names.push(name);
		const codes = value
			.split(",")
			.map((code) => code.trim())
			.filter(Boolean);
		filters.set(dimension, [...(filters.get(dimension) ?? []), ...codes]);
	}
	return { filters, names };
};

/** The choices a refusal lists, each the request that reads one series. */
export const describeChoices = (
	measure: DimensionalMeasure,
	candidates: Series[],
	hrefFor: (series: Series) => string,
) =>
	candidates.map((series) => ({
		dimensions: series.dimensions,
		...(series.datasetId ? { datasetId: series.datasetId } : {}),
		label: series.catalogueMeasure.label,
		href: hrefFor(series),
	}));

/** Where a path names a measure, a choice's request in measure-and-filter form. */
export const pathChoiceHref =
	(measure: DimensionalMeasure, url: URL, index: number) =>
	(series: Series) => {
		const query = new URLSearchParams(url.search);
		for (const [dimension, code] of Object.entries(series.dimensions))
			query.set(dimension, code);
		if (series.datasetId) query.set("datasetId", series.datasetId);
		const segments = url.pathname.split("/");
		segments[index + 1] = measure.id;
		return `${segments.join("/")}?${query}`;
	};

const seriesGeographies = (series: Series) =>
	new Set(
		series.catalogueMeasure.sources.map(
			(source) => source.sourceGeography.type,
		),
	);

/**
 * Narrow series that differ only by dataset to those published on the
 * geography asked for, or on one the place could be.
 */
const narrowByGeography = (
	candidates: Series[],
	url: URL,
	context: DimensionContext,
) => {
	if (new Set(candidates.flatMap(seriesDatasets)).size <= 1)
		return candidates;
	const geography = url.searchParams.get("geography");
	const place = url.searchParams.get("place")?.trim();
	const geographies = geography
		? new Set([geography])
		: place && context.geographyResolver?.places
			? new Set(
					context.geographyResolver
						.places(place, 12)
						.map((candidate) => candidate.geography)
						.concat(
							/^[a-zA-Z]+\//.test(place)
								? [place.split("/")[0]!]
								: [],
						),
				)
			: undefined;
	if (!geographies) return candidates;
	const narrowed = candidates.filter((series) =>
		[...seriesGeographies(series)].some((type) => geographies.has(type)),
	);
	return narrowed.length > 0 ? narrowed : candidates;
};

/** What a measure id or reviewed alias in a request names. */
export type MeasureTerm =
	| { kind: "unknown" }
	| { kind: "problem"; response: ApiResponse }
	| {
			kind: "measure";
			measure: DimensionalMeasure;
			/** The series a reviewed alias names, which fixes its members. */
			aliased?: { series: Series };
	  };

/**
 * Read a measure id or reviewed human alias, refusing old encoded series ids.
 */
export const readMeasureTerm = (
	dataCatalog: DataCatalog,
	catalogue: DimensionCatalogue,
	term: string,
): MeasureTerm => {
	const catalogueId = canonicalMeasureId(dataCatalog, term);
	const named = catalogue.measure(term);
	const aliased =
		!named && catalogueId ? catalogue.series(catalogueId) : undefined;
	const measure = named ?? aliased?.measure;
	if (!measure) return { kind: "unknown" };
	if (
		aliased &&
		(catalogueId === term || measureSlug(term) === catalogueId) &&
		aliased.series.id !== measure.id
	)
		return {
			kind: "problem",
			response: problem(
				404,
				"Not Found",
				"No published measure matches that id.",
			),
		};
	return { kind: "measure", measure, ...(aliased ? { aliased } : {}) };
};

/**
 * A reviewed alias may name a series; a filter cannot change its members.
 * Sets the alias's members in `filters`, or returns the problem.
 */
export const fixAliasMembers = (
	term: string,
	measure: DimensionalMeasure,
	aliased: { series: Series } | undefined,
	filters: Map<string, string[]>,
): ApiResponse | undefined => {
	const fixed = aliased?.series.dimensions ?? {};
	for (const [dimension, code] of Object.entries(fixed)) {
		const asked = filters.get(dimension);
		if (asked && !(asked.length === 1 && asked[0] === code))
			return invalidQuery(
				`${term} is ${measure.id} with ${dimension}=${code}, so it cannot also be filtered to ${dimension}=${asked.join(",")}. Use /v1/data/${measure.id} to choose members.`,
			);
		filters.set(dimension, [code]);
	}
	return undefined;
};

/** The problem for a filter on a dimension the measure does not have. */
export const unknownDimension = (
	measure: DimensionalMeasure,
	dimension: string,
) =>
	invalidQuery(
		measure.dimensions.length === 0
			? `${measure.id} has no dimensions, so it takes no ${dimension} filter.`
			: `${measure.id} has no ${dimension} dimension. Its dimensions are ${measure.dimensions.map((candidate) => candidate.id).join(", ")}.`,
		{
			code: "unknown_dimension",
			dimensions: measure.dimensions.map((candidate) => candidate.id),
		},
	);

/** The problem for a filter that names a member the measure does not have. */
const unknownMembers = (
	measure: DimensionalMeasure,
	dimension: string,
	unknown: string[],
	members: string[],
) =>
	invalidQuery(
		`${unknown.join(", ")} ${unknown.length === 1 ? "is not a member" : "are not members"} of ${dimension} for ${measure.id}. GET /v1/measures/${measure.id} lists them.`,
		{ code: "unknown_dimension_member", dimension, members },
	);

/**
 * The series of a measure that a set of filters selects, with a dimension left
 * out taking its total. More than one come back where the filters leave it
 * open, and the caller decides whether that is a breakdown or ambiguous.
 */
export const selectSeries = ({
	measure,
	filters,
	datasetId,
	url,
	context,
	hrefFor,
}: {
	measure: DimensionalMeasure;
	filters: Map<string, string[]>;
	datasetId: string | undefined;
	url: URL;
	context: DimensionContext;
	hrefFor: (series: Series) => string;
}): { problem: ApiResponse } | { candidates: Series[] } => {
	const refused = filterProblem(measure, filters);
	if (refused?.kind === "unknown_dimension")
		return { problem: unknownDimension(measure, refused.dimension) };
	if (refused?.kind === "unknown_member")
		return {
			problem: unknownMembers(
				measure,
				refused.dimension,
				refused.unknown,
				refused.members,
			),
		};
	let candidates = matchingSeries(measure, filters, datasetId);
	candidates = narrowByGeography(candidates, url, context);
	if (candidates.length > 0)
		candidates = preferDefaultBreakdown(measure, candidates);
	if (candidates.length === 0)
		return {
			problem: problem(
				404,
				"Not Found",
				`${measure.id} is not published for that combination of members${datasetId ? ` from ${datasetId}` : ""}. GET /v1/measures/${measure.id} lists the series it has.`,
				{
					code: "no_matching_series",
					choices: describeChoices(measure, measure.series, hrefFor),
				},
			),
		};
	return { candidates };
};
