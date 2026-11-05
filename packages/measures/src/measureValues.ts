import {
	isNumericObservation,
	observationsFor,
	type AnyMeasureObservationArtifact,
	type DataCatalog,
	type Measure,
	type MeasureSource,
	type PopulationObservation,
} from "./index.ts";
import {
	dimensionCatalogue,
	identityDimensions,
	type Dimension,
	type DimensionalMeasure,
	type Series,
} from "./dimensionCatalogue.ts";
import type { MeasureDimensions } from "./measureDimensionsLoader.ts";
import {
	filterProblem,
	matchingSeries,
	preferDefaultBreakdown,
	seriesDatasets,
} from "./seriesMatching.ts";
import { aggregationRule } from "./aggregationRule.ts";
import { calculateWeightedMean } from "./weightedMean.ts";
import { defaultSource, publishedPartitions } from "./sourceSelection.ts";

/**
 * The values of one measure for a set of areas and periods, with what a
 * renderer needs to draw them. It reads through `observationsFor` over the
 * observation artifacts the API serves, selects series with the logic the API's
 * routes use, and combines areas by the measure's own declaration, so a chart,
 * a legend and a map fill can be driven by `valueKind`, `unit` and the
 * dimensions without a per-dataset recipe.
 */

/** What the query reads. The API holds all three already. */
export type MeasureValuesContext = {
	dataCatalog: DataCatalog;
	/** The reviewed mapping; each catalogue measure is its own when absent. */
	measureDimensions?: MeasureDimensions;
	measureObservations: AnyMeasureObservationArtifact[];
};

export type MeasureValuesRequest = {
	/** A measure id such as `population`, or a catalogue series id. */
	measure: string;
	/** Members by dimension id. A dimension left out takes its total or default. */
	dimensions?: Readonly<Record<string, readonly string[]>>;
	/** Chooses between datasets that publish the same members. */
	datasetId?: string;
	/** The source geography level, such as `localAuthority`. */
	geography?: string;
	/** The code year of that geography. */
	boundaryYear?: number;
	/** Periods wanted, in the order to return them. The source's latest by default. */
	periods?: readonly string[];
	/** Keep only these area codes, in this order. Every area the source holds by default. */
	areas?: readonly string[];
	/** Combine the areas in each group onto its code, by the measure's declaration. */
	parents?: ReadonlyArray<{ code: string; memberCodes: readonly string[] }>;
};

export type MeasureValuesProblemCode =
	| "catalogue_unavailable"
	| "unknown_measure"
	| "unknown_dimension"
	| "unknown_dimension_member"
	| "no_matching_series"
	| "ambiguous_series"
	| "no_matching_source"
	| "ambiguous_source"
	| "unknown_period"
	| "observations_unavailable"
	| "aggregation_not_supported";

export type MeasureValuesProblem = {
	ok: false;
	/** The HTTP status the API answers the same refusal with. */
	status: 400 | 404 | 409 | 422 | 503;
	code: MeasureValuesProblemCode;
	detail: string;
	/** What would make the request unambiguous, where there is a choice. */
	choices?: Array<Record<string, unknown>>;
};

/**
 * What an area's value is. `observed` and `derived` come from the publisher
 * and the API; `aggregated` and `partial` are a parent's value, `partial`
 * when some members have no value; `missing` is an area with no value.
 */
export const MEASURE_VALUE_STATUSES = [
	"observed",
	"derived",
	"aggregated",
	"partial",
	"missing",
] as const;
export type MeasureValueStatus = (typeof MEASURE_VALUE_STATUSES)[number];

const MISSING = MEASURE_VALUE_STATUSES.indexOf("missing");

export type MeasureValuesColumn = {
	period: string;
	/** One entry per area, in `areas` order; null where there is no value. */
	values: Array<number | null>;
	/** Index into `statuses` for each area. */
	status: number[];
	/** The publisher's interval, where the measure declares one. */
	lower?: Array<number | null>;
	upper?: Array<number | null>;
};

export type MeasureValuesCategoricalColumn = {
	period: string;
	categories: Array<string | null>;
	status: number[];
};

export type MeasureValuesMeasure = {
	id: string;
	label: string;
	description: string;
	valueKind: Measure["valueKind"];
	unit: string;
	aggregation: {
		kind: Measure["aggregation"]["kind"];
		operation?: "sum" | "weighted-mean";
		available: boolean;
		/** The measure that supplies the weights, for a weighted mean. */
		weightMeasure?: string;
		note?: string;
	};
	dimensions: Dimension[];
	uncertainty?: Measure["uncertainty"];
};

export type MeasureValues = {
	ok: true;
	measure: MeasureValuesMeasure;
	/** The series read: its canonical key and the member of each dimension. */
	series: { id: string; dimensions: Record<string, string> };
	source: {
		datasetId: string;
		geography: string;
		boundaryYear: number;
		/** Every period the source publishes, in its order. */
		periods: string[];
	};
	/**
	 * What the statuses in each column mean, by index. It starts with
	 * `MEASURE_VALUE_STATUSES` and adds any other status the records carry.
	 */
	statuses: string[];
	/** Period labels returned, in column order. */
	periods: string[];
	/** Area codes, or parent codes when the request combined areas. */
	areas: string[];
	columns: Array<MeasureValuesColumn | MeasureValuesCategoricalColumn>;
	/** Lowest and highest value returned, for a colour scale; null if none. */
	extent: { min: number; max: number } | null;
	/** The content hash of the observation artifact read. */
	contentHash: string;
	/** Set when areas were combined: the rule and how many parents were partial. */
	combined?: {
		operation: "sum" | "weighted-mean";
		parents: number;
		partial: number;
	};
};

export type MeasureValuesResult = MeasureValues | MeasureValuesProblem;

const refuse = (
	status: MeasureValuesProblem["status"],
	code: MeasureValuesProblemCode,
	detail: string,
	choices?: MeasureValuesProblem["choices"],
): MeasureValuesProblem => ({
	ok: false,
	status,
	code,
	detail,
	...(choices ? { choices } : {}),
});

const describeSeries = (series: Series) => ({
	dimensions: series.dimensions,
	...(series.datasetId ? { datasetId: series.datasetId } : {}),
	label: series.catalogueMeasure.label,
});

const partitions = (measure: Measure) =>
	measure.sources.map((source) => ({
		datasetId: source.datasetId,
		geography: source.sourceGeography.type,
		boundaryYear: source.sourceGeography.boundaryYear,
		periods: source.periods,
	}));

/** Series that differ only by dataset, narrowed to those on the geography asked for. */
const narrowByGeography = (candidates: Series[], geography?: string) => {
	if (!geography || new Set(candidates.flatMap(seriesDatasets)).size <= 1)
		return candidates;
	const narrowed = candidates.filter((series) =>
		series.catalogueMeasure.sources.some(
			(source) => source.sourceGeography.type === geography,
		),
	);
	return narrowed.length > 0 ? narrowed : candidates;
};

type Resolved = {
	measure: DimensionalMeasure;
	series: Series;
};

const resolveSeries = (
	context: MeasureValuesContext,
	request: MeasureValuesRequest,
): Resolved | MeasureValuesProblem => {
	const catalogue = dimensionCatalogue(
		context.dataCatalog,
		context.measureDimensions ?? identityDimensions(context.dataCatalog),
	);
	const named = catalogue.measure(request.measure);
	const byId = named ? undefined : catalogue.catalogueSeries(request.measure);
	const measure = named ?? byId?.measure;
	if (!measure)
		return refuse(
			404,
			"unknown_measure",
			`No published measure is called ${request.measure}.`,
		);
	const filters = new Map<string, string[]>(
		Object.entries(request.dimensions ?? {}).map(([dimension, codes]) => [
			dimension,
			[...codes],
		]),
	);
	// A series id fixes its members, so a filter cannot move off them.
	for (const [dimension, code] of Object.entries(
		byId?.series.dimensions ?? {},
	)) {
		const asked = filters.get(dimension);
		if (asked && !(asked.length === 1 && asked[0] === code))
			return refuse(
				400,
				"unknown_dimension_member",
				`${request.measure} is ${measure.id} with ${dimension}=${code}, so it cannot also be filtered to ${dimension}=${asked.join(",")}.`,
			);
		filters.set(dimension, [code]);
	}
	const wrong = filterProblem(measure, filters);
	if (wrong?.kind === "unknown_dimension")
		return refuse(
			400,
			"unknown_dimension",
			measure.dimensions.length === 0
				? `${measure.id} has no dimensions, so it takes no ${wrong.dimension} filter.`
				: `${measure.id} has no ${wrong.dimension} dimension. Its dimensions are ${measure.dimensions.map((held) => held.id).join(", ")}.`,
		);
	if (wrong?.kind === "unknown_member")
		return refuse(
			400,
			"unknown_dimension_member",
			`${wrong.unknown.join(", ")} ${wrong.unknown.length === 1 ? "is not a member" : "are not members"} of ${wrong.dimension} for ${measure.id}.`,
			wrong.members.map((member) => ({ member })),
		);
	let candidates = matchingSeries(measure, filters, request.datasetId);
	candidates = narrowByGeography(candidates, request.geography);
	if (candidates.length > 0)
		candidates = preferDefaultBreakdown(measure, candidates);
	if (candidates.length === 0)
		return refuse(
			404,
			"no_matching_series",
			`${measure.id} is not published for that combination of members${request.datasetId ? ` from ${request.datasetId}` : ""}.`,
			measure.series.map(describeSeries),
		);
	if (candidates.length > 1)
		return refuse(
			409,
			"ambiguous_series",
			`${measure.id} has ${candidates.length} series for that request, and a query names one. Choose a member for each dimension.`,
			candidates.map(describeSeries),
		);
	return { measure, series: candidates[0]! };
};

const resolveSource = (
	series: Series,
	request: MeasureValuesRequest,
): { source: MeasureSource } | MeasureValuesProblem => {
	const measure = series.catalogueMeasure;
	const datasetId = request.datasetId ?? series.datasetId;
	const chosen = defaultSource(
		measure,
		{
			geography: request.geography,
			boundaryYear:
				request.boundaryYear === undefined
					? undefined
					: String(request.boundaryYear),
			datasetId,
		},
		[],
		false,
	);
	if (chosen) return { source: chosen.source };
	const matching = measure.sources.filter(
		(source) =>
			(!request.geography ||
				source.sourceGeography.type === request.geography) &&
			(request.boundaryYear === undefined ||
				source.sourceGeography.boundaryYear === request.boundaryYear) &&
			(datasetId === undefined || source.datasetId === datasetId),
	);
	if (matching.length === 0)
		return refuse(
			404,
			"no_matching_source",
			`${measure.id} is not published on that geography. Published partitions: ${publishedPartitions(measure)}.`,
			partitions(measure),
		);
	return refuse(
		400,
		"ambiguous_source",
		`${measure.id} is published on several partitions and the request does not pick one: give geography, with boundaryYear or datasetId where it has several. Published partitions: ${publishedPartitions(measure)}.`,
		partitions(measure),
	);
};

type PeriodRecords = {
	byCode: Map<string, PopulationObservation | { category: string }>;
	numeric: boolean;
};

/** One period's records by area code, or undefined if the artifact lacks it. */
const readPeriod = (
	context: MeasureValuesContext,
	measureId: string,
	source: MeasureSource,
	period: string,
): { records: PeriodRecords; contentHash: string } | undefined => {
	const observations = observationsFor(measureId, source, period, {
		measureObservations: context.measureObservations,
	});
	if (!observations) return undefined;
	const byCode = new Map<
		string,
		PopulationObservation | { category: string }
	>();
	let numeric = true;
	for (const record of observations.records) {
		if (isNumericObservation(record)) byCode.set(record.areaCode, record);
		else {
			numeric = false;
			byCode.set(record.areaCode, { category: record.category });
		}
	}
	return {
		records: { byCode, numeric },
		contentHash: observations.contentHash,
	};
};

const AGGREGATED = MEASURE_VALUE_STATUSES.indexOf("aggregated");
const PARTIAL = MEASURE_VALUE_STATUSES.indexOf("partial");

/**
 * The measure's weights for a weighted mean, on the same partition and period.
 * The weight is a catalogue measure; without one the mean cannot be taken.
 */
const readWeights = (
	context: MeasureValuesContext,
	weightMeasureId: string | undefined,
	source: MeasureSource,
	period: string,
): Map<string, number> | undefined => {
	if (!weightMeasureId) return undefined;
	const weight = context.dataCatalog.measures.find(
		(candidate) => candidate.id === weightMeasureId,
	);
	const weightSource = weight?.sources.find(
		(candidate) =>
			candidate.sourceGeography.type === source.sourceGeography.type &&
			candidate.sourceGeography.boundaryYear ===
				source.sourceGeography.boundaryYear &&
			candidate.periods.includes(period),
	);
	if (!weight || !weightSource) return undefined;
	const read = readPeriod(context, weight.id, weightSource, period);
	if (!read?.records.numeric) return undefined;
	return new Map(
		[...read.records.byCode].flatMap(([code, record]) =>
			"value" in record ? [[code, record.value] as const] : [],
		),
	);
};

type Combined = { value: number | null; status: number };

const combineGroup = (
	rule: "sum" | "weighted-mean",
	memberCodes: readonly string[],
	values: Map<string, number>,
	weights: Map<string, number> | undefined,
): Combined => {
	const members = [...new Set(memberCodes)];
	const present = members.filter((code) => values.has(code));
	if (present.length === 0) return { value: null, status: MISSING };
	if (rule === "sum")
		return {
			value: present.reduce((sum, code) => sum + values.get(code)!, 0),
			status: present.length === members.length ? AGGREGATED : PARTIAL,
		};
	// A weighted mean needs a weight for exactly the areas that have a value,
	// as the API's aggregate route does; any other mix is not guessed at.
	const weighted = calculateWeightedMean(
		present.map((code) => ({ areaCode: code, value: values.get(code)! })),
		present.flatMap((code) =>
			weights?.has(code)
				? [{ areaCode: code, value: weights.get(code)! }]
				: [],
		),
	);
	if (weighted.kind !== "ok") return { value: null, status: PARTIAL };
	return {
		value: weighted.value,
		status: present.length === members.length ? AGGREGATED : PARTIAL,
	};
};

export function queryMeasureValues(
	context: MeasureValuesContext,
	request: MeasureValuesRequest,
): MeasureValuesResult {
	// The legend starts with the statuses this module names and grows with any
	// other the publisher's records carry, such as `estimated`.
	const legend: string[] = [...MEASURE_VALUE_STATUSES];
	const statusIndex = (status: string) => {
		let index = legend.indexOf(status);
		if (index === -1) index = legend.push(status) - 1;
		return index;
	};
	const resolved = resolveSeries(context, request);
	if ("ok" in resolved) return resolved;
	const { measure: dimensional, series } = resolved;
	const catalogueMeasure = series.catalogueMeasure;
	const picked = resolveSource(series, request);
	if ("ok" in picked) return picked;
	const { source } = picked;
	const periods = [...(request.periods ?? [source.periods.at(-1)!])];
	const unknown = periods.filter(
		(period) => !source.periods.includes(period),
	);
	if (unknown.length > 0)
		return refuse(
			404,
			"unknown_period",
			`${catalogueMeasure.id} has no ${unknown.join(", ")} on ${source.sourceGeography.type} ${source.sourceGeography.boundaryYear}. It publishes ${source.periods.join(", ")}.`,
			source.periods.map((period) => ({ period })),
		);
	const rule = request.parents
		? aggregationRule(catalogueMeasure)
		: undefined;
	if (rule?.kind === "unsupported")
		return refuse(422, "aggregation_not_supported", rule.detail);
	if (rule && catalogueMeasure.valueKind === "categorical")
		return refuse(
			422,
			"aggregation_not_supported",
			"Categorical measures have no numeric value to combine.",
		);

	const reads = new Map<string, PeriodRecords>();
	let contentHash = "";
	for (const period of periods) {
		const read = readPeriod(context, catalogueMeasure.id, source, period);
		if (!read)
			return refuse(
				503,
				"observations_unavailable",
				`The observation artifact for ${catalogueMeasure.id} is missing, or does not contain ${period}.`,
			);
		reads.set(period, read.records);
		contentHash = read.contentHash;
	}

	const parents = request.parents;
	const areaSet = request.areas ? new Set(request.areas) : undefined;
	const areas: string[] = parents
		? parents
				.map((parent) => parent.code)
				.filter((code) => !areaSet || areaSet.has(code))
		: request.areas
			? [...new Set(request.areas)]
			: [
					...new Set(
						[...reads.values()].flatMap((read) => [
							...read.byCode.keys(),
						]),
					),
				].sort();

	const hasInterval = Boolean(catalogueMeasure.uncertainty && !parents);
	let min = Infinity;
	let max = -Infinity;
	const note = (value: number | null) => {
		if (value === null || !Number.isFinite(value)) return;
		if (value < min) min = value;
		if (value > max) max = value;
	};
	let partialParents = 0;
	const columns: MeasureValues["columns"] = [];
	for (const period of periods) {
		const read = reads.get(period)!;
		const status: number[] = [];
		if (!read.numeric) {
			const categories: Array<string | null> = [];
			for (const code of areas) {
				const record = read.byCode.get(code);
				categories.push(
					record && "category" in record ? record.category : null,
				);
				status.push(record ? statusIndex("observed") : MISSING);
			}
			columns.push({ period, categories, status });
			continue;
		}
		const values: Array<number | null> = [];
		const lower: Array<number | null> = [];
		const upper: Array<number | null> = [];
		if (parents && rule) {
			const own = new Map<string, number>();
			for (const [code, record] of read.byCode)
				if ("value" in record) own.set(code, record.value);
			const weights =
				rule.kind === "weighted-mean"
					? readWeights(
							context,
							rule.weighted.weight.measureId,
							source,
							period,
						)
					: undefined;
			if (rule.kind === "weighted-mean" && !weights)
				return refuse(
					422,
					"aggregation_not_supported",
					`The weights for ${catalogueMeasure.id}, ${rule.weighted.weight.measureId ?? "unnamed"}, are not served on the same areas and period, so no weighted mean was taken.`,
				);
			const groups = new Map(
				parents.map((parent) => [parent.code, parent.memberCodes]),
			);
			for (const code of areas) {
				const combined = combineGroup(
					rule.kind,
					groups.get(code) ?? [],
					own,
					weights,
				);
				values.push(combined.value);
				status.push(combined.status);
				note(combined.value);
				if (period === periods[0] && combined.status === PARTIAL)
					partialParents += 1;
			}
		} else {
			for (const code of areas) {
				const record = read.byCode.get(code);
				const numeric =
					record && "value" in record ? record : undefined;
				values.push(numeric ? numeric.value : null);
				status.push(numeric ? statusIndex(numeric.status) : MISSING);
				note(numeric ? numeric.value : null);
				if (hasInterval) {
					lower.push(numeric?.confidenceInterval?.lower ?? null);
					upper.push(numeric?.confidenceInterval?.upper ?? null);
				}
			}
		}
		columns.push({
			period,
			values,
			status,
			...(hasInterval && lower.some((value) => value !== null)
				? { lower, upper }
				: {}),
		});
	}

	const aggregation = catalogueMeasure.aggregation;
	return {
		ok: true,
		measure: {
			id: dimensional.id,
			label: dimensional.label,
			description: dimensional.description,
			valueKind: catalogueMeasure.valueKind,
			unit: catalogueMeasure.unit,
			aggregation: {
				kind: aggregation.kind,
				...(aggregation.kind === "extensive"
					? { operation: aggregation.operation }
					: aggregation.kind === "intensive"
						? {
								operation: aggregation.operation,
								weightMeasure: aggregation.weight.measureId,
							}
						: {}),
				available: aggregation.available,
				...("note" in aggregation ? { note: aggregation.note } : {}),
			},
			dimensions: dimensional.dimensions,
			...(catalogueMeasure.uncertainty
				? { uncertainty: catalogueMeasure.uncertainty }
				: {}),
		},
		series: { id: series.id, dimensions: series.dimensions },
		source: {
			datasetId: source.datasetId,
			geography: source.sourceGeography.type,
			boundaryYear: source.sourceGeography.boundaryYear,
			periods: [...source.periods],
		},
		statuses: legend,
		periods,
		areas,
		columns,
		extent: max >= min ? { min, max } : null,
		contentHash,
		...(parents && rule
			? {
					combined: {
						operation: rule.kind,
						parents: areas.length,
						partial: partialParents,
					},
				}
			: {}),
	};
}
