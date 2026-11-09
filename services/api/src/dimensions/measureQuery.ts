import { problem, type ApiResponse } from "../runtime/index.ts";
import {
	dimensionCatalogue,
	identityDimensions,
	type DimensionalMeasure,
	type Series,
} from "@uk-data-atlas/measures";
import {
	describeChoices,
	fixAliasMembers,
	readFilters,
	readMeasureTerm,
	selectSeries,
	seriesDatasets,
	unknownDimension,
	type DimensionContext,
} from "./seriesSelection";

/**
 * Measures named in a `measure` query parameter, such as
 * `?measure=recorded-crimes&offence=burglary`, read as the series they mean.
 *
 * Each value names one series. A measure takes the dimension filters that
 * name its own dimensions, and a dimension left out takes its total, as in a
 * path. With several `measure` values a filter applies to each measure that
 * has the dimension and is ignored by those that do not, and so is `datasetId`,
 * which chooses between datasets that publish the same members, such as
 * general and local election turnout. A reviewed human alias such as `house-prices` is accepted; an old encoded series id such as
 * `crime-burglary` is refused with the measure and members that replace it.
 *
 * The routes read series by their catalogue id, so the request is rewritten
 * to carry those, and the dimension parameters are removed.
 */

export type MeasureQueryResolution =
	| { kind: "unchanged" }
	| { kind: "problem"; response: ApiResponse }
	| {
			kind: "rewritten";
			/** The request, naming series by catalogue id. */
			url: string;
			/** The request in measure-and-filter form, as the API read it. */
			location: string;
			/** The series the request named, to restate the answer for. */
			read: Array<{ series: Series; measure: DimensionalMeasure }>;
	  };

/** A choice's request: this one `measure` value, filtered to a series. */
const choiceHref =
	(url: URL, term: string, measure: DimensionalMeasure, names: string[]) =>
	(series: Series) => {
		const query = new URLSearchParams();
		let replaced = false;
		for (const [name, value] of url.searchParams) {
			if (names.includes(name)) continue;
			if (name === "measure" && value === term && !replaced) {
				query.append(name, measure.id);
				replaced = true;
			} else query.append(name, value);
		}
		for (const [dimension, code] of Object.entries(series.dimensions))
			query.set(dimension, code);
		if (series.datasetId) query.set("datasetId", series.datasetId);
		return `${url.pathname}?${query}`;
	};

export const resolveMeasureQuery = (
	parsed: URL,
	context: DimensionContext,
): MeasureQueryResolution => {
	const { dataCatalog } = context;
	if (!dataCatalog) return { kind: "unchanged" };
	const terms = parsed.searchParams.getAll("measure");
	if (terms.length === 0) return { kind: "unchanged" };
	// A server started without the reviewed mapping reads each measure as its own.
	const catalogue = dimensionCatalogue(
		dataCatalog,
		context.measureDimensions ?? identityDimensions(dataCatalog),
	);
	const reads = terms.map(
		(term) =>
			[term, readMeasureTerm(dataCatalog, catalogue, term)] as const,
	);
	for (const [, read] of reads)
		if (read.kind === "problem")
			return { kind: "problem", response: read.response };
	const { filters, names } = readFilters(
		parsed.searchParams,
		catalogue.dimensionIds,
	);
	const measures = reads.flatMap(([, read]) =>
		read.kind === "measure" ? [read.measure] : [],
	);
	// A filter applies to each measure that has the dimension, but one that no
	// listed measure has is a mistake.
	for (const dimension of filters.keys()) {
		const holders = measures.filter((measure) =>
			measure.dimensions.some((held) => held.id === dimension),
		);
		if (measures.length > 0 && holders.length === 0)
			return {
				kind: "problem",
				response:
					measures.length === 1
						? unknownDimension(measures[0]!, dimension)
						: problem(
								400,
								"Invalid Query",
								`None of ${measures.map((measure) => measure.id).join(", ")} has a ${dimension} dimension.`,
								{
									code: "unknown_dimension",
									dimensions: [
										...new Set(
											measures.flatMap((measure) =>
												measure.dimensions.map(
													(held) => held.id,
												),
											),
										),
									],
								},
							),
			};
	}
	const datasetId = parsed.searchParams.get("datasetId") ?? undefined;
	const ids: string[] = [];
	const named: Array<{ series: Series; measure: DimensionalMeasure }> = [];
	const publicMeasures: string[] = [];
	// The members each dimension is read at across the request, for the
	// request restated in measure-and-filter form.
	const stated = new Map<string, Set<string>>(
		[...filters].map(([dimension, codes]) => [dimension, new Set(codes)]),
	);
	for (const [term, read] of reads) {
		if (read.kind !== "measure") {
			ids.push(term);
			publicMeasures.push(term);
			continue;
		}
		const { measure, aliased } = read;
		const own = new Map(
			[...filters].filter(([dimension]) =>
				measure.dimensions.some((held) => held.id === dimension),
			),
		);
		const conflict = fixAliasMembers(term, measure, aliased, own);
		if (conflict) return { kind: "problem", response: conflict };
		const hrefFor = choiceHref(parsed, term, measure, names);
		const selected = selectSeries({
			measure,
			filters: own,
			datasetId:
				datasetId !== undefined &&
				measures.length > 1 &&
				!measure.series.some((series) =>
					seriesDatasets(series).includes(datasetId),
				)
					? undefined
					: datasetId,
			url: parsed,
			context,
			hrefFor,
		});
		if ("problem" in selected)
			return { kind: "problem", response: selected.problem };
		const { candidates } = selected;
		if (candidates.length > 1)
			return {
				kind: "problem",
				response: problem(
					409,
					"Ambiguous Measure",
					`${measure.id} has ${candidates.length} series for that request, and a measure parameter names one. Choose a member for each dimension; each request is listed in choices.`,
					{
						code: "ambiguous_dimension",
						choices: describeChoices(measure, candidates, hrefFor),
					},
				),
			};
		ids.push(candidates[0]!.catalogueMeasure.id);
		named.push({ series: candidates[0]!, measure });
		publicMeasures.push(measure.id);
		for (const [dimension, codes] of own)
			if (!filters.has(dimension))
				stated.set(
					dimension,
					new Set([...(stated.get(dimension) ?? []), ...codes]),
				);
	}
	if (
		names.length === 0 &&
		!(datasetId !== undefined && measures.length > 0) &&
		ids.every((id, index) => id === terms[index])
	)
		return { kind: "unchanged" };
	const rewrite = (measuresOut: string[]) => {
		const next = new URL(parsed);
		for (const name of names) next.searchParams.delete(name);
		next.searchParams.delete("measure");
		for (const measure of measuresOut)
			next.searchParams.append("measure", measure);
		return next;
	};
	const internal = rewrite(
		["/v1/attribution", "/v1/relationships"].includes(parsed.pathname) ||
			/^\/v1\/areas\/[^/]+\/[^/]+\/[^/]+$/.test(parsed.pathname)
			? publicMeasures
			: ids,
	);
	// The series ids already say which dataset.
	if (measures.length > 0) internal.searchParams.delete("datasetId");
	const external = rewrite(publicMeasures);
	for (const [dimension, codes] of stated)
		external.searchParams.set(dimension, [...codes].join(","));
	return {
		kind: "rewritten",
		url: internal.pathname + internal.search,
		location: external.pathname + external.search,
		read: named,
	};
};
