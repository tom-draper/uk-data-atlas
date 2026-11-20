import {
	carryOverEdge,
	convertThroughSteps,
	newTally,
	settle,
	startValues,
	type CarriedValue,
	type GapReason,
} from "./convert.ts";
import {
	CONVERSION_BASES,
	type ConversionBasis,
	type Step,
} from "./crosswalkSteps.ts";
import type { Route, Router } from "./routes.ts";
import { bestRoute } from "./standardPlan.ts";

/**
 * A chain is a route, collapsed. Each area of an old release gets one edge to
 * every area of the current release its value can reach, with the weight and
 * the error that the route's steps add up to, so a value moves from one to
 * the other in a single join.
 *
 * Nothing here decides how an edge carries a value. The route is the best
 * route the converter would pick, each hop is a `Step`, and the weights and
 * error are `carryOverEdge` applied to a unit value on the start area, so a
 * value carried through the steps and a value carried by a chain agree.
 */

/**
 * The most crosswalks a chain may join. A ward of 2011 reaches the current
 * wards through 15 and a local authority of 2011 through 16, so the converter's
 * `MAX_ROUTE_HOPS` is too short for the oldest releases.
 */
export const MAX_CHAIN_HOPS = 25;

/** Why an area of the old release has no edge down one branch of its chain. */
export type ChainGapReason =
	| GapReason
	/** The area is in no crosswalk of a hop it reaches, so its value is lost. */
	| "not-in-crosswalk";

export type ChainEdge = {
	from: number;
	to: number;
	/** The share of a value on `from` that arrives on `to`. */
	weight: number;
	/** The share of the value that passed through a split, so may be wrong. */
	atRisk: number;
	/** The share carried whole from an area that pruned pairs put partly elsewhere. */
	pruned: number;
	/** The share carried by an edge that is not an exact regrouping. */
	estimated: number;
	/** The crosswalks whose splits the value passed through. */
	splits: ReadonlySet<number>;
	/**
	 * True where every area feeding `to`, at every step, had a value, so a
	 * value set on every area of the old release arrives on `to` whole. False
	 * where some feeder was blocked or missing: the weight is right for this
	 * area, but the sum on `to` is short.
	 */
	complete: boolean;
};

export type ChainGap = { from: number; reason: ChainGapReason };

export type Chain = {
	fromRelease: number;
	toRelease: number;
	/** The basis the weights are on, or null where every basis gives the same chain. */
	basis: ConversionBasis | null;
	route: Route;
	edges: ChainEdge[];
	gaps: ChainGap[];
};

/** Which areas, and which of their branches, a step cannot carry on. */
const throughOne = (steps: readonly Step[], start: number) => {
	let held = startValues([[start, 1]]);
	const lost: ChainGapReason[] = [];
	for (const step of steps) {
		const tallies = new Map<number, ReturnType<typeof newTally>>();
		for (const [area, carried] of held) {
			const edges = step.edges.get(area);
			if (edges)
				for (const edge of edges) {
					let tally = tallies.get(edge.to);
					if (!tally) tallies.set(edge.to, (tally = newTally()));
					carryOverEdge(tally, carried, edge);
				}
			else
				lost.push(step.blocked.get(area)?.reason ?? "not-in-crosswalk");
		}
		held = new Map<number, CarriedValue>(
			[...tallies].map(([area, tally]) => [area, settle(tally)]),
		);
	}
	return { reached: held, lost };
};

/**
 * The chain for one route and one basis, from every area in `starts`, the
 * versions of the route's first release.
 */
export const composeChain = (
	router: Router,
	route: Route,
	basis: ConversionBasis,
	starts: readonly number[],
): Chain => {
	const steps = route.map((hop) => router.step(hop, basis));
	const converted = convertThroughSteps(
		steps,
		startValues(starts.map((area) => [area, 1] as const)),
	);
	const edges: ChainEdge[] = [];
	const gaps: ChainGap[] = [];
	for (const from of starts) {
		const { reached, lost } = throughOne(steps, from);
		for (const [to, carried] of reached)
			edges.push({
				from,
				to,
				weight: carried.value,
				atRisk: carried.atRisk,
				pruned: carried.pruned,
				estimated: carried.estimated,
				splits: carried.splits,
				complete: converted.values.has(to),
			});
		// One gap per area: the first reason found, since a reader needs to know
		// that part of the value is lost, and the weights say how much.
		if (lost.length > 0) gaps.push({ from, reason: lost[0]! });
	}
	edges.sort((a, b) => a.from - b.from || a.to - b.to);
	return {
		fromRelease: route[0]!.fromRelease,
		toRelease: route.at(-1)!.toRelease,
		basis,
		route,
		edges,
		gaps,
	};
};

const sameChain = (a: Chain, b: Chain) =>
	a.edges.length === b.edges.length &&
	a.gaps.length === b.gaps.length &&
	a.edges.every((edge, index) => {
		const other = b.edges[index]!;
		return (
			edge.from === other.from &&
			edge.to === other.to &&
			edge.weight === other.weight &&
			edge.atRisk === other.atRisk &&
			edge.pruned === other.pruned &&
			edge.estimated === other.estimated &&
			edge.complete === other.complete &&
			[...edge.splits].join() === [...other.splits].join()
		);
	}) &&
	a.gaps.every(
		(gap, index) =>
			gap.from === b.gaps[index]!.from &&
			gap.reason === b.gaps[index]!.reason,
	);

/**
 * The chains from one release to another, one per basis, or one for every
 * basis where the four bases give the same chain: an exact regrouping weighs 1
 * whatever the basis, and nothing in it depends on a held count. Undefined where
 * no route joins the releases.
 */
export const chainsBetween = (
	router: Router,
	fromRelease: number,
	toRelease: number,
	starts: readonly number[],
	maxHops = MAX_CHAIN_HOPS,
): Chain[] | undefined => {
	const route = bestRoute(router.routes(fromRelease, toRelease, maxHops));
	if (!route) return undefined;
	const chains = CONVERSION_BASES.map((basis) =>
		composeChain(router, route, basis, starts),
	);
	return chains.every((chain) => sameChain(chain, chains[0]!))
		? [{ ...chains[0]!, basis: null }]
		: chains;
};
