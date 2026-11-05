import { invalidQuery, problem, type ApiResponse } from "../runtime/index.ts";
import {
	dimensionCatalogue,
	type DimensionalMeasure,
	type Series,
} from "@uk-data-atlas/measures";
import { resolveMeasureQuery } from "./measureQuery";
import {
	describeChoices,
	fixAliasMembers,
	pathChoiceHref,
	readFilters,
	readMeasureTerm,
	sameShape,
	selectSeries,
	type DimensionContext,
} from "./seriesSelection";

/**
 * A request that names a measure and dimension filters, read as a request
 * for one series by its catalogue id, or for several to answer together.
 *
 * `GET /v1/data/recorded-crimes/value?place=Leeds&offence=burglary` is read
 * as `GET /v1/data/crime-burglary/value?place=Leeds`. A filter is a query
 * parameter named after the dimension, or `dimensions[offence]=burglary`; it
 * takes one member, several separated by commas, or `*` for every member.
 * A dimension left out takes its total where the measure publishes one, and
 * the response says so in `defaults`.
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

/** What a resolved request says about how it was read. */
export type DimensionReading = {
	measure: DimensionalMeasure;
	/** The reviewed alias the request named. */
	resolvedFrom?: { id: string };
	/** Dimensions the request left out, and the member chosen for each. */
	defaulted: Record<string, string>;
	/**
	 * The request as the API reads it, in measure-and-filter form, where that
	 * differs from what was asked: an alias, a default or `dimensions[...]`.
	 */
	canonicalUrl?: string;
};

export type DimensionResolution =
	| { kind: "unchanged" }
	| { kind: "problem"; response: ApiResponse }
	| {
			/** A `measure` query parameter read as series; see measureQuery. */
			kind: "rewritten";
			url: string;
			location: string;
			read: Array<{ series: Series; measure: DimensionalMeasure }>;
	  }
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

/** Read a request's measure and filters, or leave it as it is. */
export const resolveDimensionRequest = (
	url: string,
	context: DimensionContext,
): DimensionResolution => {
	const { dataCatalog, measureDimensions } = context;
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
	if (!position) return resolveMeasureQuery(parsed, context);
	if (!dataCatalog || !measureDimensions) return { kind: "unchanged" };
	const catalogue = dimensionCatalogue(dataCatalog, measureDimensions);
	const term = segments[position.index]!;
	const read = readMeasureTerm(dataCatalog, catalogue, term);
	if (read.kind === "unknown") return { kind: "unchanged" };
	if (read.kind === "problem")
		return { kind: "problem", response: read.response };
	const { measure, aliased } = read;
	const { filters, names } = readFilters(
		parsed.searchParams,
		catalogue.dimensionIds,
	);
	// The measure detail lists every member.
	if (position.operation === "measure")
		return names.length > 0
			? {
					kind: "problem",
					response: invalidQuery(
						"A measure's definition lists every member of its dimensions, so it takes no dimension filters.",
					),
				}
			: { kind: "unchanged" };
	const conflict = fixAliasMembers(term, measure, aliased, filters);
	if (conflict) return { kind: "problem", response: conflict };
	const datasetId = parsed.searchParams.get("datasetId") ?? undefined;
	const hrefFor = pathChoiceHref(measure, parsed, position.index);
	const selected = selectSeries({
		measure,
		filters,
		datasetId,
		url: parsed,
		context,
		hrefFor,
	});
	if ("problem" in selected)
		return { kind: "problem", response: selected.problem };
	const { candidates } = selected;
	const defaulted: Record<string, string> = {};
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
					choices: describeChoices(measure, candidates, hrefFor),
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
		path[position.index] = series.catalogueMeasure.id;
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
		canonical.searchParams.set(dimension, codes.join(","));
	for (const [dimension, code] of Object.entries(defaulted))
		canonical.searchParams.set(dimension, code);
	const canonicalPath = [...segments];
	canonicalPath[position.index] = measure.id;
	const canonicalUrl = `/${canonicalPath
		.map((segment) => encodeURIComponent(segment).replaceAll("%3A", ":"))
		.join("/")}${canonical.search}`;
	const rewrittenRequest =
		aliased !== undefined ||
		Object.keys(defaulted).length > 0 ||
		names.some((name) => name.startsWith("dimensions["));
	const reading: DimensionReading = {
		measure,
		...(aliased
			? {
					resolvedFrom: {
						id: term,
					},
				}
			: {}),
		defaulted,
		...(rewrittenRequest ? { canonicalUrl } : {}),
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
