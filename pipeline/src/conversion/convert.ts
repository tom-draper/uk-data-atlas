import type { BlockReason, Step } from "./crosswalkSteps.ts";

/**
 * Carries a set of values through crosswalk steps onto the last step's areas.
 *
 * A target gets a value only when every source area that feeds it has one.
 * A missing or blocked feeder leaves the target without a value and with a
 * reason, never with a partial sum.
 */

/** A value on an area, with what the conversion did to it so far. */
export type CarriedValue = {
	value: number;
	/**
	 * How much of the value passed through a split and so could be in the
	 * wrong area.
	 */
	atRisk: number;
	/**
	 * How much of the value was carried whole from an area that a crosswalk's
	 * pruned pairs put partly elsewhere. It errs one way: the value is too
	 * high by about this much.
	 */
	pruned: number;
	/** The crosswalks whose splits the value passed through. */
	splits: ReadonlySet<number>;
	/** How many source areas contributed. */
	inputs: number;
};

/** Why a target area has no value. */
export type GapReason =
	| BlockReason
	/** A feeding source area has no value, while others do. */
	| "missing-input";

export type ConvertedValues = {
	values: Map<number, CarriedValue>;
	/** Target areas left without a value, though some input reached them. */
	gaps: Map<number, GapReason>;
	/** Areas with a value that no crosswalk edge carried anywhere, by step. */
	uncarried: number[][];
};

const NO_SPLITS: ReadonlySet<number> = new Set();

export const startValues = (
	values: Iterable<readonly [number, number]>,
): Map<number, CarriedValue> => {
	const started = new Map<number, CarriedValue>();
	for (const [area, value] of values)
		started.set(area, {
			value,
			atRisk: 0,
			pruned: 0,
			splits: NO_SPLITS,
			inputs: 1,
		});
	return started;
};

const throughStep = (
	step: Step,
	held: Map<number, CarriedValue>,
	gaps: Map<number, GapReason>,
) => {
	const next = new Map<number, CarriedValue>();
	const nextGaps = new Map<number, GapReason>();
	const uncarried: number[] = [];
	// A gap is carried forward to everything it would have fed.
	for (const [area, reason] of gaps)
		for (const target of step.edges.get(area)?.map((edge) => edge.to) ??
			step.blocked.get(area)?.targets ??
			[])
			nextGaps.set(target, nextGaps.get(target) ?? reason);
	for (const [area, blocked] of step.blocked)
		if (held.has(area))
			for (const target of blocked.targets)
				nextGaps.set(target, nextGaps.get(target) ?? blocked.reason);
	const targets = new Set<number>();
	for (const area of held.keys()) {
		const edges = step.edges.get(area);
		if (edges) for (const edge of edges) targets.add(edge.to);
		else if (!step.blocked.has(area)) uncarried.push(area);
	}
	for (const target of targets) {
		if (nextGaps.has(target)) continue;
		let value = 0;
		let atRisk = 0;
		let pruned = 0;
		let inputs = 0;
		let splits: Set<number> | undefined;
		let missing = false;
		for (const source of step.feeders.get(target) ?? []) {
			const carried = held.get(source);
			if (!carried) {
				missing = true;
				break;
			}
			for (const edge of step.edges.get(source) ?? []) {
				if (edge.to !== target) continue;
				value += carried.value * edge.weight;
				atRisk +=
					carried.atRisk * edge.weight + carried.value * edge.risk;
				pruned +=
					carried.pruned * edge.weight + carried.value * edge.pruned;
				inputs += carried.inputs;
				if (edge.risk > 0 || edge.pruned > 0)
					(splits ??= new Set()).add(edge.crosswalk);
				if (carried.splits.size > 0)
					for (const id of carried.splits)
						(splits ??= new Set()).add(id);
			}
		}
		if (missing) nextGaps.set(target, "missing-input");
		else
			next.set(target, {
				value,
				atRisk,
				pruned,
				splits: splits ?? NO_SPLITS,
				inputs,
			});
	}
	return { next, nextGaps, uncarried };
};

/** True where no split or pruned pair touched the value: an exact regrouping. */
export const isRegrouped = (value: Pick<CarriedValue, "atRisk" | "pruned">) =>
	value.atRisk === 0 && value.pruned === 0;

/** Carry values on the first step's source areas through every step. */
export const convertThroughSteps = (
	steps: readonly Step[],
	values: Map<number, CarriedValue>,
): ConvertedValues => {
	let held = values;
	let gaps = new Map<number, GapReason>();
	const uncarried: number[][] = [];
	for (const step of steps) {
		const result = throughStep(step, held, gaps);
		held = result.next;
		gaps = result.nextGaps;
		uncarried.push(result.uncarried);
	}
	return { values: held, gaps, uncarried };
};

/** Why a target area has no rebuilt mean. */
export type MeanGapReason =
	| GapReason
	/** The mean or its weight passed through a split. */
	| "unmeasured-split"
	/** The converted weight is not above zero. */
	| "no-denominator";

export type ConvertedMeans = {
	values: Map<number, number>;
	gaps: Map<number, MeanGapReason>;
	/** Source areas holding a mean or a weight that no step carried anywhere. */
	uncarried: Set<number>;
};

/**
 * Rebuild a weighted mean on the last step's areas: the sum of each source
 * area's mean times its weight, over the sum of the weights.
 *
 * A source area takes part only with both its mean and its weight. One that
 * holds a single half is a missing input to every target it feeds. Only an
 * exact regrouping gives a value, because no split of a mean is measured.
 */
export const convertWeightedMeans = (
	steps: readonly Step[],
	means: ReadonlyMap<number, number>,
	weights: ReadonlyMap<number, number>,
): ConvertedMeans => {
	const paired = [...means].filter(([area]) => weights.has(area));
	const tops = convertThroughSteps(
		steps,
		startValues(
			paired.map(([area, mean]) => [area, mean * weights.get(area)!]),
		),
	);
	const bottoms = convertThroughSteps(
		steps,
		startValues(paired.map(([area]) => [area, weights.get(area)!])),
	);
	const values = new Map<number, number>();
	const gaps = new Map<number, MeanGapReason>(tops.gaps);
	const uncarried = new Set(tops.uncarried.flat());
	for (const [area, top] of tops.values) {
		const bottom = bottoms.values.get(area)!;
		if (!isRegrouped(top) || !isRegrouped(bottom))
			gaps.set(area, "unmeasured-split");
		else if (bottom.value <= 0) gaps.set(area, "no-denominator");
		else values.set(area, top.value / bottom.value);
	}
	// Whatever an area holding one half alone reaches is left without a value.
	for (const half of [means, weights]) {
		const reached = convertThroughSteps(steps, startValues(half));
		for (const area of reached.uncarried.flat()) uncarried.add(area);
		for (const [area, reason] of reached.gaps)
			if (!values.has(area) && !gaps.has(area)) gaps.set(area, reason);
		for (const area of reached.values.keys())
			if (!values.has(area) && !gaps.has(area))
				gaps.set(area, "missing-input");
	}
	return { values, gaps, uncarried };
};
