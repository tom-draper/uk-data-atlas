import {
	invalidQuery,
	problem,
	type ApiResponse,
	type RouteDispatchContext,
} from "@uk-data-atlas/atlas-runtime/api";
import { canonicalMeasureId } from "../catalogue/measureTerms";
import {
	dimensionCatalogue,
	type DimensionalMeasure,
	type Series,
} from "./dimensionCatalogue";

/**
 * A request that names a measure and dimension filters, read as a request
 * for one series by its catalogue id, or for several to answer together.
 *
 * `GET /v1/data/recorded-crimes/value?place=Leeds&offence=burglary` is read
 * as `GET /v1/data/crime-burglary/value?place=Leeds`. A filter is a query
 * parameter named after the dimension, or `dimensions[offence]=burglary`; it
 * takes one member, several separated by commas, or `*` for every member.
 * A dimension left out takes its total where the measure publishes one, and
 * the response says so in `defaults`. Old encoded ids such as `crime-burglary`
 * still work: each is read as its measure with its members fixed, and the
 * response names it in `resolvedFrom`.
 */

/** Where a path carries a measure id, and the operation it names. */
const measurePosition = (segments: string[]) => {
	if (segments[0] !== "v1") return undefined;
	if (segments[1] === "data" && segments[2] !== undefined)
		return { index: 2, operation: segments[3] ?? "table" };
	if (segments[1] === "measures" && segments.length === 3)
		return { index: 2, operation: "measure" };
	if (segments[1] === "map-resources" && segments[4] === "join")
		return { index: 5, operation: "join" };
	return undefined;
};

/** Operations that answer several series at once, one entry per series. */
const BREAKDOWN_OPERATIONS = new Set(["value", "series"]);

const ALL = "*";

export type ResolvedMembers = Record<
	string,
	{ member: string; label: string; defaulted?: true }
>;

/** What a resolved request says about how it was read. */
export type DimensionReading = {
	measure: DimensionalMeasure;
	/** The term the request named, where it was an alias or old id. */
	resolvedFrom?: { id: string; deprecated: boolean };
	/** Dimensions the request left out, and the member chosen for each. */
	defaulted: Record<string, string>;
	/** The request as the API reads it, in measure-and-filter form. */
	canonicalUrl: string;
};

export type DimensionResolution =
	| { kind: "unchanged" }
	| { kind: "problem"; response: ApiResponse }
	| {
			kind: "series";
			url: string;
			series: Series;
			reading: DimensionReading;
	  }
	| {
			kind: "breakdown";
			entries: Array<{ url: string; series: Series }>;
			reading: DimensionReading;
	  };

/** The dimension filters a query carries, by dimension id. */
const readFilters = (
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

/** The query parameters a measure's dimension filters take. */
export const isDimensionParameter = (
	name: string,
	dimensionIds: ReadonlySet<string>,
) => dimensionIds.has(name) || /^dimensions\[[^\]]+\]$/.test(name);

const describeChoices = (
	measure: DimensionalMeasure,
	candidates: Series[],
	url: URL,
	index: number,
) =>
	candidates.map((series) => {
		const query = new URLSearchParams(url.search);
		for (const [dimension, code] of Object.entries(series.dimensions))
			query.set(dimension, code);
		if (series.datasetId) query.set("datasetId", series.datasetId);
		const segments = url.pathname.split("/");
		segments[index + 1] = measure.id;
		return {
			dimensions: series.dimensions,
			...(series.datasetId ? { datasetId: series.datasetId } : {}),
			label: series.catalogueMeasure.label,
			href: `${segments.join("/")}?${query}`,
		};
	});

/** The dataset a series is read from, where it has only one. */
const seriesDatasets = (series: Series) =>
	series.datasetId
		? [series.datasetId]
		: [...new Set(series.catalogueMeasure.sources.map((s) => s.datasetId))];

const seriesGeographies = (series: Series) =>
	new Set(
		series.catalogueMeasure.sources.map(
			(source) => source.sourceGeography.type,
		),
	);

const sameShape = (left: Series, right: Series) =>
	Object.keys(left.dimensions).sort().join() ===
		Object.keys(right.dimensions).sort().join() &&
	(left.datasetId ?? "") === (right.datasetId ?? "");

/**
 * Narrow series that differ only by dataset to those published on the
 * geography asked for, or on one the place could be.
 */
const narrowByGeography = (
	candidates: Series[],
	url: URL,
	context: RouteDispatchContext,
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

/** Read a request's measure and filters, or leave it as it is. */
export const resolveDimensionRequest = (
	url: string,
	context: RouteDispatchContext,
): DimensionResolution => {
	const { dataCatalog, measureDimensions } = context;
	if (!dataCatalog || !measureDimensions) return { kind: "unchanged" };
	const parsed = new URL(url, "http://localhost");
	let segments: string[];
	try {
		segments = parsed.pathname
			.split("/")
			.filter(Boolean)
			.map(decodeURIComponent);
	} catch {
		return { kind: "unchanged" };
	}
	const position = measurePosition(segments);
	if (!position) return { kind: "unchanged" };
	const catalogue = dimensionCatalogue(dataCatalog, measureDimensions);
	const term = segments[position.index]!;
	const catalogueId = canonicalMeasureId(dataCatalog, term);
	const named = catalogue.measure(term);
	const aliased =
		!named && catalogueId ? catalogue.series(catalogueId) : undefined;
	const measure = named ?? aliased?.measure;
	if (!measure) return { kind: "unchanged" };
	const { filters, names } = readFilters(
		parsed.searchParams,
		catalogue.dimensionIds,
	);
	// The measure detail lists every member, and resolves old ids itself.
	if (position.operation === "measure")
		return names.length > 0
			? {
					kind: "problem",
					response: invalidQuery(
						"A measure's definition lists every member of its dimensions, so it takes no dimension filters.",
					),
				}
			: { kind: "unchanged" };
	// An old id fixes its members; a filter may repeat one but not change it.
	const fixed = aliased?.series.dimensions ?? {};
	for (const [dimension, code] of Object.entries(fixed)) {
		const asked = filters.get(dimension);
		if (asked && !(asked.length === 1 && asked[0] === code))
			return {
				kind: "problem",
				response: invalidQuery(
					`${term} is ${measure.id} with ${dimension}=${code}, so it cannot also be filtered to ${dimension}=${asked.join(",")}. Use /v1/data/${measure.id} to choose members.`,
					{ code: "conflicting_dimension_filter" },
				),
			};
		filters.set(dimension, [code]);
	}
	for (const [dimension, codes] of filters) {
		const held = measure.dimensions.find(
			(candidate) => candidate.id === dimension,
		);
		if (!held)
			return {
				kind: "problem",
				response: invalidQuery(
					measure.dimensions.length === 0
						? `${measure.id} has no dimensions, so it takes no ${dimension} filter.`
						: `${measure.id} has no ${dimension} dimension. Its dimensions are ${measure.dimensions.map((candidate) => candidate.id).join(", ")}.`,
					{
						code: "unknown_dimension",
						dimensions: measure.dimensions.map(
							(candidate) => candidate.id,
						),
					},
				),
			};
		const unknown = codes.filter(
			(code) =>
				code !== ALL &&
				!held.members.some((member) => member.code === code),
		);
		if (unknown.length > 0)
			return {
				kind: "problem",
				response: invalidQuery(
					`${unknown.join(", ")} ${unknown.length === 1 ? "is not a member" : "are not members"} of ${dimension} for ${measure.id}. GET /v1/measures/${measure.id} lists them.`,
					{
						code: "unknown_dimension_member",
						dimension,
						members: held.members.map((member) => member.code),
					},
				),
			};
	}
	const datasetId = parsed.searchParams.get("datasetId") ?? undefined;
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
	const defaulted: Record<string, string> = {};
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
	candidates = narrowByGeography(candidates, parsed, context);
	const shapes = candidates.filter((series) =>
		sameShape(series, candidates[0]!),
	);
	if (candidates.length > 1 && shapes.length < candidates.length) {
		// Series of different breakdowns, such as households by tenure and by
		// car availability: the measure's reviewed default chooses, if any.
		const preferred = candidates.filter((series) =>
			Object.entries(measure.defaults).every(
				([dimension, code]) => series.dimensions[dimension] === code,
			),
		);
		if (Object.keys(measure.defaults).length > 0 && preferred.length > 0)
			candidates = preferred;
	}
	if (candidates.length === 0)
		return {
			kind: "problem",
			response: problem(
				404,
				"Not Found",
				`${measure.id} is not published for that combination of members${datasetId ? ` from ${datasetId}` : ""}. GET /v1/measures/${measure.id} lists the series it has.`,
				{
					code: "no_matching_series",
					choices: describeChoices(
						measure,
						measure.series,
						parsed,
						position.index,
					),
				},
			),
		};
	const breakdown =
		candidates.length > 1 &&
		candidates.every((series) => sameShape(series, candidates[0]!));
	if (
		candidates.length > 1 &&
		(!breakdown || !BREAKDOWN_OPERATIONS.has(position.operation))
	)
		return {
			kind: "problem",
			response: problem(
				409,
				"Ambiguous Measure",
				breakdown
					? `${measure.id} has ${candidates.length} series for that request, and this operation answers one. Choose a member for each dimension; each request is listed in choices. /value and /series answer several at once.`
					: `${measure.id} has ${candidates.length} series for that request that are not parts of one breakdown. Choose one; each request is listed in choices.`,
				{
					code: "ambiguous_dimension",
					choices: describeChoices(
						measure,
						candidates,
						parsed,
						position.index,
					),
				},
			),
		};
	// What the request left to the API, stated in the response.
	if (candidates.length === 1)
		for (const [dimension, code] of Object.entries(
			candidates[0]!.dimensions,
		))
			if (!filters.has(dimension)) defaulted[dimension] = code;
	const rewritten = (series: Series) => {
		const next = new URL(parsed);
		for (const name of names) next.searchParams.delete(name);
		const path = [...segments];
		path[position.index] = series.id;
		next.pathname = `/${path
			.map((segment) =>
				encodeURIComponent(segment).replaceAll("%3A", ":"),
			)
			.join("/")}`;
		return next.pathname + next.search;
	};
	const canonical = new URL(parsed);
	for (const name of names) canonical.searchParams.delete(name);
	for (const [dimension, codes] of filters)
		if (!(dimension in fixed) || aliased)
			canonical.searchParams.set(dimension, codes.join(","));
	for (const [dimension, code] of Object.entries(defaulted))
		canonical.searchParams.set(dimension, code);
	const canonicalPath = [...segments];
	canonicalPath[position.index] = measure.id;
	const reading: DimensionReading = {
		measure,
		...(aliased
			? {
					resolvedFrom: {
						id: term,
						deprecated: aliased.series.id !== measure.id,
					},
				}
			: {}),
		defaulted,
		canonicalUrl: `/${canonicalPath
			.map((segment) =>
				encodeURIComponent(segment).replaceAll("%3A", ":"),
			)
			.join("/")}${canonical.search}`,
	};
	if (candidates.length === 1)
		return {
			kind: "series",
			url: rewritten(candidates[0]!),
			series: candidates[0]!,
			reading,
		};
	return {
		kind: "breakdown",
		entries: candidates.map((series) => ({
			url: rewritten(series),
			series,
		})),
		reading,
	};
};
