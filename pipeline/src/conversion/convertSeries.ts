import type { DatabaseSync } from "node:sqlite";
import { TOTAL_POPULATION } from "./backtestCases.ts";
import {
	convertThroughSteps,
	convertWeightedMeans,
	isRegrouped,
	startValues,
	type CarriedValue,
	type ConvertedValues,
	type GapReason,
} from "./convert.ts";
import type { PlanEntry } from "./convertedPlan.ts";
import type { ConversionBasis, Step } from "./crosswalkSteps.ts";
import { boundsOf } from "./errorModel.ts";
import { stepsOf, type Resolver } from "./pinnedRoutes.ts";
import type { ConversionRule } from "./rules.ts";
import {
	periodsOfSeries,
	publishedSeries,
	type SeriesRow,
} from "./seriesValues.ts";

/**
 * Builds the converted series of one plan entry.
 *
 * A value that only regrouped whole areas is kept as `derived`, with no
 * bounds, because nothing was estimated. A value that passed through a split
 * is kept as `estimated`, with bounds, only where the plan asks for estimates,
 * the measure's split has been backtested on the basis used, the series is a
 * total and the split's method has a measured error. Every other target is a
 * gap with its reason. A converted value never takes the status `observed`.
 */

/** `status.id` of a value that regrouped whole areas. */
export const STATUS_DERIVED = 6;
/** `status.id` of a value that passed through a split. */
export const STATUS_ESTIMATED = 2;
const STATUS_OBSERVED = 1;

export type SeriesGapReason =
	| GapReason
	/** The value passed through a split that is not estimated. */
	| "unmeasured-split"
	/** A source area's value that no crosswalk on the route carries anywhere. */
	| "not-carried"
	/** A rebuilt ratio or mean whose converted denominator or weight is not above zero. */
	| "no-denominator";

export type ConvertedObservation = {
	area: number;
	period: number;
	value: number;
	status: typeof STATUS_DERIVED | typeof STATUS_ESTIMATED;
	lower: number | null;
	upper: number | null;
	/**
	 * How much of `value` took a split or a pruned pair on its way. Absent
	 * for a regrouped value, which took none.
	 */
	estimated?: number;
};

/**
 * How far a converted series can be trusted to be a regrouping of what was
 * published, rather than an estimate or a partial cover.
 */
export type Quality = {
	/**
	 * The share of the series' value, summed over every value it holds, that
	 * reached its area by regrouping whole source areas. 1 where no value was
	 * split, and less where estimated values took a split.
	 */
	exactShare: number;
	/**
	 * The share of the areas and periods reached at all, or dropped by a
	 * crosswalk that does not carry them, that hold a value. A source area no
	 * crosswalk carries counts against it, so a series that loses changed wards
	 * does not score as whole.
	 */
	coverage: number;
};

/** The quality of a series from the values and the gaps it ended with. */
export const qualityOf = (
	observations: readonly ConvertedObservation[],
	gaps: readonly SeriesGap[],
): Quality => {
	let total = 0;
	let estimated = 0;
	for (const o of observations) {
		// A measure can hold negative values, such as a net change, so the share
		// is of the magnitude, and rounding never takes it outside 0 to 1.
		total += Math.abs(o.value);
		estimated += Math.min(o.estimated ?? 0, Math.abs(o.value));
	}
	const reached = observations.length + gaps.length;
	return {
		exactShare:
			total > 0 ? Math.min(1, Math.max(0, 1 - estimated / total)) : 1,
		coverage: reached > 0 ? observations.length / reached : 0,
	};
};

export type SeriesGap = {
	/** The target area, or the source area where the reason is `not-carried`. */
	area: number;
	period: number;
	reason: SeriesGapReason;
};

export type InputRole = "value" | "numerator" | "denominator" | "weight";

export type ConvertedSeries = {
	planId: string;
	key: string;
	datasetId: number;
	measureId: number;
	releaseId: number;
	rule: "sum" | "rebuild";
	basis: ConversionBasis;
	/** The first is the series the converted one derives from. */
	inputs: { role: InputRole; series: SeriesRow }[];
	crosswalks: {
		position: number;
		id: number;
		slug: string;
		reversed: boolean;
	}[];
	note: string | null;
	periods: number;
	quality: Quality;
	observations: ConvertedObservation[];
	gaps: SeriesGap[];
	/**
	 * For a rebuilt ratio, the same rebuild made on the source areas and
	 * compared with the published ratio there.
	 */
	sourceCheck?: { compared: number; maxDifference: number };
};

/** The error factor of a splitting method on a basis, where one was measured. */
export type ErrorFactors = (
	method: string,
	basis: ConversionBasis,
) => number | undefined;

/** The factors the backtest fitted for a total population. */
export const readErrorFactors = (backtest: DatabaseSync): ErrorFactors => {
	const factors = new Map(
		(
			backtest
				.prepare(
					"SELECT method, basis_id AS basis, factor FROM conversion_error WHERE measure_class = ?",
				)
				.all(TOTAL_POPULATION) as {
				method: string;
				basis: string;
				factor: number;
			}[]
		).map((row) => [`${row.method}|${row.basis}`, row.factor]),
	);
	return (method, basis) => factors.get(`${method}|${basis}`);
};

/** Why a published series was not converted onto the plan entry's target. */
export type SkipReason =
	/** The target release already holds a published series for the same measure and members. */
	| "published-on-target"
	/** A rebuilt ratio or mean lacks a published numerator, denominator or weight to be rebuilt from. */
	| "missing-component"
	/** The route reached no value: every target was a gap. */
	| "no-values";

export type ConversionContext = {
	database: DatabaseSync;
	resolver: Resolver;
	/** The rule of each measure, by slug. */
	rules: ReadonlyMap<string, ConversionRule>;
	factors: ErrorFactors;
	/** Told of every published series the entry left out, and why. */
	skipped?: (entry: PlanEntry, source: SeriesRow, reason: SkipReason) => void;
};

export const convertedKey = (sourceKey: string, target: string) =>
	`${sourceKey}~converted:${target}`;

/** The members of the published series a release holds for a dataset's measure. */
const membersPublished = (
	database: DatabaseSync,
	entry: PlanEntry,
	release: number,
) =>
	new Set(
		publishedSeries(database, {
			dataset: entry.source.dataset,
			measure: entry.source.measure,
			release,
		}).map((series) => series.members),
	);

/** Only observed values are converted. A flagged or empty one is a missing input. */
const observedValues = (
	database: DatabaseSync,
	series: number,
	period: number,
) =>
	startValues(
		(
			database
				.prepare(
					"SELECT area_version_id AS area, value FROM observation WHERE series_id = ? AND period_id = ? AND value IS NOT NULL AND status_id = ?",
				)
				.all(series, period, STATUS_OBSERVED) as {
				area: number;
				value: number;
			}[]
		).map((row) => [row.area, row.value] as const),
	);

const plain = (values: ReadonlyMap<number, CarriedValue>) =>
	new Map([...values].map(([area, carried]) => [area, carried.value]));

const idsOfSeries = (database: DatabaseSync, series: number) =>
	database
		.prepare(
			"SELECT dataset_id AS datasetId, measure_id AS measureId FROM series WHERE id = ? AND method = 'published'",
		)
		.get(series) as { datasetId: number; measureId: number };

const crosswalksOf = (steps: readonly Step[]) =>
	steps
		.flatMap((step) =>
			step.crosswalks.map((crosswalk) => ({
				id: crosswalk.id,
				slug: crosswalk.slug,
				reversed: step.reversed,
			})),
		)
		.map((crosswalk, position) => ({ position, ...crosswalk }));

const collectGaps = (
	converted: ConvertedValues,
	period: number,
	gaps: SeriesGap[],
	seen = new Set<number>(),
) => {
	for (const [area, reason] of converted.gaps)
		if (!seen.has(area)) {
			seen.add(area);
			gaps.push({ area, period, reason });
		}
	for (const area of converted.uncarried.flat())
		if (!seen.has(area)) {
			seen.add(area);
			gaps.push({ area, period, reason: "not-carried" });
		}
	return seen;
};

/**
 * The converted series of a plan entry. Where the context listens for skips,
 * a source that reached no value is skipped, not stored empty.
 */
export function* convertEntry(
	context: ConversionContext,
	entry: PlanEntry,
): Generator<ConvertedSeries> {
	for (const converted of convertSources(context, entry)) {
		if (context.skipped && converted.observations.length === 0)
			context.skipped(entry, converted.inputs[0]!.series, "no-values");
		else yield converted;
	}
}

function* convertSources(
	context: ConversionContext,
	entry: PlanEntry,
): Generator<ConvertedSeries> {
	const { database, resolver } = context;
	const basis = entry.basis ?? "population";
	const from = resolver.releaseId(entry.source.release);
	const to = resolver.releaseId(entry.target);
	const steps = stepsOf(resolver, entry.route, basis, from);
	if (steps.at(-1)?.toRelease !== to)
		throw new Error(
			`${entry.id}: the route does not end on ${entry.target}`,
		);
	const rule = context.rules.get(entry.source.measure);
	if (!rule)
		throw new Error(`${entry.id}: no measure ${entry.source.measure}`);
	if (rule.rule === "refuse")
		throw new Error(
			`${entry.id}: ${entry.source.measure} is refused. ${rule.reason}`,
		);
	const seriesOf = (measure: string) =>
		publishedSeries(database, {
			dataset: entry.source.dataset,
			measure,
			release: from,
		});
	const onTarget = membersPublished(database, entry, to);
	const skip = (source: SeriesRow, reason: SkipReason) =>
		context.skipped?.(entry, source, reason);
	const sources = seriesOf(entry.source.measure).filter((series) => {
		if (entry.members && !entry.members.test(series.members)) return false;
		if (!onTarget.has(series.members)) return true;
		skip(series, "published-on-target");
		return false;
	});
	if (sources.length === 0 && !context.skipped)
		throw new Error(`${entry.id}: no published series to convert`);
	const methodOf = (crosswalk: number) =>
		resolver.router.crosswalk(crosswalk).method;
	/** The factor of a split value, where its splits are of one measured method. */
	const factorOf = (carried: CarriedValue) => {
		const methods = new Set([...carried.splits].map(methodOf));
		if (methods.size !== 1) return undefined;
		return context.factors([...methods][0]!, basis);
	};
	const weights =
		rule.rule === "rebuild" && "weight" in rule
			? seriesOf(rule.weight)
			: undefined;
	const parts =
		rule.rule === "rebuild" && !("weight" in rule)
			? {
					numerator: seriesOf(rule.numerator),
					denominator: seriesOf(rule.denominator),
				}
			: undefined;

	for (const source of sources) {
		const observations: ConvertedObservation[] = [];
		const gaps: SeriesGap[] = [];
		const periods = periodsOfSeries(database, source.id);
		const base = {
			planId: entry.id,
			key: convertedKey(source.key, entry.target),
			...idsOfSeries(database, source.id),
			releaseId: to,
			basis,
			crosswalks: crosswalksOf(steps),
			note: entry.note ?? null,
			periods: periods.length,
			observations,
			gaps,
		};
		if (rule.rule === "sum") {
			const estimable =
				entry.estimates === true &&
				rule.splitBasis === basis &&
				source.members === "";
			for (const period of periods) {
				const converted = convertThroughSteps(
					steps,
					observedValues(database, source.id, period.id),
				);
				const seen = collectGaps(converted, period.id, gaps);
				for (const [area, carried] of converted.values) {
					if (isRegrouped(carried)) {
						observations.push({
							area,
							period: period.id,
							value: carried.value,
							status: STATUS_DERIVED,
							lower: null,
							upper: null,
						});
						continue;
					}
					const factor = estimable ? factorOf(carried) : undefined;
					if (factor === undefined) {
						if (!seen.has(area))
							gaps.push({
								area,
								period: period.id,
								reason: "unmeasured-split",
							});
						continue;
					}
					observations.push({
						area,
						period: period.id,
						value: carried.value,
						status: STATUS_ESTIMATED,
						estimated: carried.estimated,
						...boundsOf(carried, factor),
					});
				}
			}
			yield {
				...base,
				quality: qualityOf(observations, gaps),
				rule: "sum",
				inputs: [{ role: "value", series: source }],
			};
			continue;
		}

		if ("weight" in rule) {
			// The weight broken down as the mean is, or else the one weight held
			// with no breakdown, which then weights every breakdown of the mean.
			const weight =
				weights!.find((series) => series.members === source.members) ??
				(weights!.length === 1 && weights![0]!.members === ""
					? weights![0]
					: undefined);
			if (!weight) {
				if (!context.skipped)
					throw new Error(
						`${entry.id}: ${source.key} has no published ${rule.weight} to be weighted by`,
					);
				skip(source, "missing-component");
				continue;
			}
			for (const period of periods) {
				const rebuilt = convertWeightedMeans(
					steps,
					plain(observedValues(database, source.id, period.id)),
					plain(observedValues(database, weight.id, period.id)),
				);
				for (const [area, value] of rebuilt.values)
					observations.push({
						area,
						period: period.id,
						value,
						status: STATUS_DERIVED,
						lower: null,
						upper: null,
					});
				for (const [area, reason] of rebuilt.gaps)
					gaps.push({ area, period: period.id, reason });
				for (const area of rebuilt.uncarried)
					gaps.push({
						area,
						period: period.id,
						reason: "not-carried",
					});
			}
			yield {
				...base,
				quality: qualityOf(observations, gaps),
				rule: "rebuild",
				inputs: [
					{ role: "value", series: source },
					{ role: "weight", series: weight },
				],
			};
			continue;
		}

		const numerator = parts!.numerator.find(
			(series) => series.members === source.members,
		);
		const denominator = parts!.denominator.find(
			(series) => series.members === source.members,
		);
		if (!numerator || !denominator) {
			if (!context.skipped)
				throw new Error(
					`${entry.id}: ${source.key} has no published ${numerator ? rule.denominator : rule.numerator} to be rebuilt from`,
				);
			skip(source, "missing-component");
			continue;
		}
		const check = { compared: 0, maxDifference: 0 };
		for (const period of periods) {
			const top = observedValues(database, numerator.id, period.id);
			const bottom = observedValues(database, denominator.id, period.id);
			// The same rebuild on the source areas, against what was published there.
			for (const [area, published] of observedValues(
				database,
				source.id,
				period.id,
			)) {
				const n = top.get(area);
				const d = bottom.get(area);
				if (!n || !d || d.value <= 0) continue;
				check.compared += 1;
				check.maxDifference = Math.max(
					check.maxDifference,
					Math.abs(
						(rule.scale * n.value) / d.value - published.value,
					),
				);
			}
			const tops = convertThroughSteps(steps, top);
			const bottoms = convertThroughSteps(steps, bottom);
			const seen = collectGaps(tops, period.id, gaps);
			collectGaps(bottoms, period.id, gaps, seen);
			const gap = (area: number, reason: SeriesGapReason) => {
				if (seen.has(area)) return;
				seen.add(area);
				gaps.push({ area, period: period.id, reason });
			};
			for (const [area, n] of tops.values) {
				const d = bottoms.values.get(area);
				if (!d) gap(area, "missing-input");
				else if (!isRegrouped(n) || !isRegrouped(d))
					gap(area, "unmeasured-split");
				else if (d.value <= 0) gap(area, "no-denominator");
				else
					observations.push({
						area,
						period: period.id,
						value: (rule.scale * n.value) / d.value,
						status: STATUS_DERIVED,
						lower: null,
						upper: null,
					});
			}
			for (const area of bottoms.values.keys())
				if (!tops.values.has(area)) gap(area, "missing-input");
		}
		yield {
			...base,
			quality: qualityOf(observations, gaps),
			rule: "rebuild",
			inputs: [
				{ role: "numerator", series: numerator },
				{ role: "denominator", series: denominator },
			],
			sourceCheck: check,
		};
	}
}
