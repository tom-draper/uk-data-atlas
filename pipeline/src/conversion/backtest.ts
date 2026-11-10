import type { DatabaseSync } from "node:sqlite";
import type { BacktestCase, CaseHop, CaseSeries } from "./backtestCases.ts";
import {
	convertThroughSteps,
	isRegrouped,
	startValues,
	type GapReason,
} from "./convert.ts";
import type { ConversionBasis, Step } from "./crosswalkSteps.ts";
import { createRouter, type Router } from "./routes.ts";
import {
	areaNamer,
	periodsOfSeries,
	publishedSeries,
	valuesOfSeries,
	type SeriesRow,
} from "./seriesValues.ts";

/**
 * Runs the backtest cases: converts each source series along its pinned route
 * and compares every converted value with the published truth for the area.
 */

/** A count is exact when it rounds to the published one. */
export const EXACT_TOLERANCE = 0.5;

/** One converted value set against the published one. */
export type ComparedValue = {
	caseId: string;
	basis: ConversionBasis;
	members: string;
	period: string;
	area: number;
	converted: number;
	truth: number;
	atRisk: number;
	pruned: number;
	inputs: number;
};

export type WorstValue = {
	members: string;
	period: string;
	code: string;
	name: string;
	converted: number;
	truth: number;
	atRisk: number;
};

/** The error of one class of value, within a case and basis. */
export type ErrorSummary = {
	/** `regrouped`: no split touched the value. `split`: one did. */
	kind: "regrouped" | "split";
	compared: number;
	exact: number;
	medianRelative: number | null;
	p95Relative: number | null;
	maxRelative: number | null;
	meanAbsolute: number;
	maxAbsolute: number;
	/** Quantiles of `|error| / atRisk`, for a split only. */
	medianPerRisk: number | null;
	p95PerRisk: number | null;
	maxPerRisk: number | null;
	worst: WorstValue[];
};

export type CaseResult = {
	case: BacktestCase;
	basis: ConversionBasis;
	/** Source series with a truth series of the same members, and periods compared. */
	series: number;
	periods: number;
	/** Why the case could not be run on this basis, if it could not. */
	skipped?: string;
	summaries: ErrorSummary[];
	/** Target areas with a published truth and no converted value, by reason. */
	gaps: Partial<Record<GapReason | "no-edge", number>>;
	/** Target areas with a converted value and a published truth. */
	compared: number;
	/** Target areas with a converted value and no published truth. */
	unchecked: number;
};

export const quantile = (sorted: readonly number[], q: number) => {
	if (sorted.length === 0) return null;
	const at = (sorted.length - 1) * q;
	const low = Math.floor(at);
	const high = Math.ceil(at);
	return sorted[low]! + (sorted[high]! - sorted[low]!) * (at - low);
};

const ascending = (values: number[]) => values.sort((a, b) => a - b);

export const summarise = (
	kind: ErrorSummary["kind"],
	rows: readonly ComparedValue[],
	name: (area: number) => { code: string; name: string },
	worstCount = 5,
): ErrorSummary => {
	const absolute = rows.map((row) => Math.abs(row.converted - row.truth));
	const relative = ascending(
		rows.flatMap((row, index) =>
			row.truth > 0 ? [absolute[index]! / row.truth] : [],
		),
	);
	const perRisk = ascending(
		rows.flatMap((row, index) =>
			row.atRisk > 0 ? [absolute[index]! / row.atRisk] : [],
		),
	);
	// The worst cases are the largest relative errors on values big enough for
	// a relative error to mean something.
	const worst = rows
		.map((row, index) => ({ row, error: absolute[index]! }))
		.filter(
			({ row, error }) => row.truth >= 100 && error >= EXACT_TOLERANCE,
		)
		.sort((a, b) => b.error / b.row.truth - a.error / a.row.truth)
		.slice(0, worstCount)
		.map(({ row }) => ({
			members: row.members,
			period: row.period,
			...name(row.area),
			converted: row.converted,
			truth: row.truth,
			atRisk: row.atRisk,
		}));
	return {
		kind,
		compared: rows.length,
		exact: absolute.filter((error) => error < EXACT_TOLERANCE).length,
		medianRelative: quantile(relative, 0.5),
		p95Relative: quantile(relative, 0.95),
		maxRelative: relative.at(-1) ?? null,
		meanAbsolute:
			absolute.reduce((sum, error) => sum + error, 0) /
			Math.max(1, absolute.length),
		maxAbsolute: absolute.reduce((max, error) => Math.max(max, error), 0),
		medianPerRisk: quantile(perRisk, 0.5),
		p95PerRisk: quantile(perRisk, 0.95),
		maxPerRisk: perRisk.at(-1) ?? null,
		worst,
	};
};

type Resolver = {
	router: Router;
	releaseId(release: string): number;
	crosswalkId(slug: string): number;
};

const createResolver = (database: DatabaseSync): Resolver => {
	const release = database.prepare(
		"SELECT id FROM area_releases WHERE geography = ? AND release = ?",
	);
	const crosswalk = database.prepare(
		"SELECT id FROM crosswalk WHERE slug = ?",
	);
	return {
		router: createRouter(database),
		releaseId(key) {
			const [geography, name] = key.split(":");
			const row = release.get(geography!, name!) as
				{ id: number } | undefined;
			if (!row) throw new Error(`No release ${key}`);
			return row.id;
		},
		crosswalkId(slug) {
			const row = crosswalk.get(slug) as { id: number } | undefined;
			if (!row) throw new Error(`No crosswalk ${slug}`);
			return row.id;
		},
	};
};

const stepsOf = (
	resolver: Resolver,
	hops: readonly CaseHop[],
	basis: ConversionBasis,
	from: number,
): Step[] => {
	let at = from;
	return hops.map((hop) => {
		const made = resolver.router.hop(
			hop.crosswalks.map(resolver.crosswalkId),
			hop.reversed,
		);
		if (made.fromRelease !== at)
			throw new Error(
				`Hop ${hop.crosswalks.join(", ")} does not start where the route has reached`,
			);
		at = made.toRelease;
		return resolver.router.step(made, basis);
	});
};

const seriesOf = (
	database: DatabaseSync,
	resolver: Resolver,
	selector: CaseSeries,
	release = resolver.releaseId(selector.release),
) =>
	new Map(
		publishedSeries(database, { ...selector, release }).map((series) => [
			series.members,
			series,
		]),
	);

export type BacktestOptions = {
	/** Called with every compared value, for analysis beyond the summaries. */
	onValue?: (value: ComparedValue) => void;
};

export const runBacktestCase = (
	database: DatabaseSync,
	entry: BacktestCase,
	basis: ConversionBasis,
	options: BacktestOptions = {},
	resolver = createResolver(database),
): CaseResult => {
	const name = areaNamer(database);
	const result: CaseResult = {
		case: entry,
		basis,
		series: 0,
		periods: 0,
		summaries: [],
		gaps: {},
		compared: 0,
		unchecked: 0,
	};
	const steps = stepsOf(
		resolver,
		entry.route,
		basis,
		resolver.releaseId(entry.source.release),
	);
	const target = steps.at(-1)!.toRelease;
	const truthRelease = resolver.releaseId(entry.truth.release);
	// The truth is always carried on population weights: its route is exact,
	// so the basis changes nothing.
	const truthSteps = entry.truthRoute
		? stepsOf(resolver, entry.truthRoute, "population", truthRelease)
		: [];
	if ((truthSteps.at(-1)?.toRelease ?? truthRelease) !== target)
		throw new Error(
			`Case ${entry.id}: the truth does not end on the target`,
		);
	const sources = seriesOf(database, resolver, entry.source);
	const truths = seriesOf(database, resolver, entry.truth);
	const published =
		truthSteps.length > 0
			? seriesOf(database, resolver, entry.truth, target)
			: new Map<string, SeriesRow>();
	const targetAreas = new Set(steps.at(-1)!.feeders.keys());
	const matching = (held: Map<string, SeriesRow>, pattern: RegExp) =>
		[...held].flatMap(([members, row]) =>
			pattern.test(members) ? [row.id] : [],
		);
	const one = (held: Map<string, SeriesRow>, members: string) => {
		const row = held.get(members);
		return row ? [row.id] : [];
	};
	// What is compared: each source series with the truth series of the same
	// members, or the sum of several series on each side.
	const groups = entry.total
		? [
				{
					members: entry.total.label,
					source: matching(sources, entry.total.source),
					truth: matching(truths, entry.total.truth),
					published: matching(published, entry.total.truth),
				},
			]
		: [...sources.keys()]
				.filter(
					(members) => !entry.members || entry.members.test(members),
				)
				.map((members) => ({
					members,
					source: one(sources, members),
					truth: one(truths, members),
					published: one(published, members),
				}));
	const summed = (ids: readonly number[], period: number) => {
		const total = new Map<number, number>();
		const seen = new Map<number, number>();
		for (const id of ids)
			for (const [area, value] of valuesOfSeries(database, id, period)) {
				total.set(area, (total.get(area) ?? 0) + value);
				seen.set(area, (seen.get(area) ?? 0) + 1);
			}
		// An area missing from one of the series has no sum.
		for (const [area, count] of seen)
			if (count !== ids.length) total.delete(area);
		return total;
	};

	const rows: ComparedValue[] = [];
	const periodLabels = new Set<string>();
	for (const group of groups) {
		const { members } = group;
		if (group.source.length === 0 || group.truth.length === 0) continue;
		const truthPeriods = new Set(
			periodsOfSeries(database, group.truth[0]!).map(
				(period) => period.id,
			),
		);
		let used = false;
		for (const period of periodsOfSeries(database, group.source[0]!)) {
			if (!truthPeriods.has(period.id)) continue;
			if (entry.periods && !entry.periods.includes(period.label))
				continue;
			const truthValues = summed(group.truth, period.id);
			if (truthSteps.length > 0) {
				const carried = convertThroughSteps(
					truthSteps,
					startValues(truthValues),
				);
				truthValues.clear();
				for (const [area, value] of carried.values)
					if (isRegrouped(value)) truthValues.set(area, value.value);
				for (const [area, value] of summed(group.published, period.id))
					truthValues.set(area, value);
			}
			if (truthValues.size === 0) continue;
			const converted = convertThroughSteps(
				steps,
				startValues(summed(group.source, period.id)),
			);
			used = true;
			periodLabels.add(period.label);
			for (const [area, value] of converted.values) {
				const expected = truthValues.get(area);
				if (expected === undefined) {
					result.unchecked += 1;
					continue;
				}
				const row: ComparedValue = {
					caseId: entry.id,
					basis,
					members,
					period: period.label,
					area,
					converted: value.value,
					truth: expected,
					atRisk: value.atRisk,
					pruned: value.pruned,
					inputs: value.inputs,
				};
				rows.push(row);
				options.onValue?.(row);
			}
			for (const area of truthValues.keys()) {
				if (converted.values.has(area)) continue;
				const reason =
					converted.gaps.get(area) ??
					(targetAreas.has(area) ? "missing-input" : "no-edge");
				result.gaps[reason] = (result.gaps[reason] ?? 0) + 1;
			}
		}
		if (used) result.series += 1;
	}
	result.periods = periodLabels.size;
	result.compared = rows.length;
	if (result.series === 0)
		result.skipped =
			"No source series has a truth series for the same period";
	const regrouped = rows.filter(isRegrouped);
	const split = rows.filter((row) => !isRegrouped(row));
	if (regrouped.length > 0)
		result.summaries.push(summarise("regrouped", regrouped, name));
	if (split.length > 0)
		result.summaries.push(summarise("split", split, name));
	return result;
};

export const runBacktest = (
	database: DatabaseSync,
	cases: readonly BacktestCase[],
	options: BacktestOptions & {
		onCase?: (result: CaseResult, milliseconds: number) => void;
	} = {},
): CaseResult[] => {
	const resolver = createResolver(database);
	const results: CaseResult[] = [];
	for (const entry of cases)
		for (const basis of entry.bases) {
			const started = performance.now();
			const result = runBacktestCase(
				database,
				entry,
				basis,
				options,
				resolver,
			);
			results.push(result);
			options.onCase?.(result, performance.now() - started);
		}
	return results;
};
