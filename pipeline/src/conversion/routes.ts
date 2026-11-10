import type { DatabaseSync } from "node:sqlite";
import {
	CARRYING_METHODS,
	buildStep,
	isExactMethod,
	readCrosswalks,
	reverseStep,
	weightTablesOf,
	type ConversionBasis,
	type CrosswalkRow,
	type Step,
} from "./crosswalkSteps.ts";

/**
 * The routes a value can take from one release to another: which crosswalks
 * join which releases, and every way of chaining them.
 */

/** One move between two releases, through every crosswalk that joins them. */
export type Hop = {
	fromRelease: number;
	toRelease: number;
	/** Crosswalk ids, in id order. */
	crosswalks: number[];
	/** True where the crosswalks are walked from their targets to their sources. */
	reversed: boolean;
	/** True where no crosswalk in the hop can split a value. */
	exact: boolean;
};

export type Route = Hop[];

type Release = { id: number; geography: string; release: string };

export type Router = {
	crosswalk(id: number): CrosswalkRow;
	release(id: number): Release;
	/** The hop through the crosswalks given, which must join the same releases. */
	hop(crosswalks: readonly number[], reversed?: boolean): Hop;
	step(hop: Hop, basis: ConversionBasis): Step;
	/** Every route of at most `maxHops` hops, shortest first. */
	routes(fromRelease: number, toRelease: number, maxHops?: number): Route[];
};

const carries = (method: string) =>
	(CARRYING_METHODS as readonly string[]).includes(method);

export const routeKey = (route: Route) =>
	route
		.map((hop) => `${hop.reversed ? "~" : ""}${hop.crosswalks.join("+")}`)
		.join(">");

export const createRouter = (database: DatabaseSync): Router => {
	const weights = weightTablesOf(database);
	const crosswalks = new Map(
		readCrosswalks(database).map((row) => [row.id, row]),
	);
	const releases = new Map(
		(
			database
				.prepare("SELECT id, geography, release FROM area_releases")
				.all() as Release[]
		).map((row) => [row.id, row]),
	);
	const crosswalk = (id: number) => {
		const row = crosswalks.get(id);
		if (!row) throw new Error(`No crosswalk ${id}`);
		return row;
	};
	const release = (id: number) => {
		const row = releases.get(id);
		if (!row) throw new Error(`No release ${id}`);
		return row;
	};
	const hop = (ids: readonly number[], reversed = false): Hop => {
		const rows = ids.map(crosswalk);
		const [first] = rows;
		if (!first) throw new Error("A hop needs a crosswalk");
		for (const row of rows) {
			if (
				row.fromRelease !== first.fromRelease ||
				row.toRelease !== first.toRelease
			)
				throw new Error(
					`Crosswalks ${first.slug} and ${row.slug} join different releases`,
				);
			if (!carries(row.method))
				throw new Error(
					`Crosswalk ${row.slug} (${row.method}) cannot carry a value`,
				);
			if (reversed && row.method !== "extent-continuity")
				throw new Error(
					`Crosswalk ${row.slug} (${row.method}) cannot be walked in reverse`,
				);
		}
		return {
			fromRelease: reversed ? first.toRelease : first.fromRelease,
			toRelease: reversed ? first.fromRelease : first.toRelease,
			crosswalks: [...ids].sort((a, b) => a - b),
			reversed,
			exact: rows.every((row) => isExactMethod(row.method)),
		};
	};

	// Every hop out of each release: forwards through all the carrying
	// crosswalks of a pair of releases, and backwards through an
	// extent-continuity crosswalk where nothing runs forwards that way. A best
	// fit is never offered: the backtest shows it leaves a target short without
	// a flag, so it can only be walked by a hop that names it.
	const forward = new Map<string, number[]>();
	for (const row of crosswalks.values()) {
		if (!carries(row.method) || row.method === "best-fit") continue;
		const key = `${row.fromRelease}>${row.toRelease}`;
		const held = forward.get(key);
		if (held) held.push(row.id);
		else forward.set(key, [row.id]);
	}
	const outgoing = new Map<number, Hop[]>();
	const offer = (made: Hop) => {
		const held = outgoing.get(made.fromRelease);
		if (held) held.push(made);
		else outgoing.set(made.fromRelease, [made]);
	};
	for (const ids of forward.values()) offer(hop(ids));
	for (const [key, ids] of forward) {
		const [from, to] = key.split(">");
		if (forward.has(`${to}>${from}`)) continue;
		const identity = ids.filter(
			(id) => crosswalk(id).method === "extent-continuity",
		);
		if (identity.length > 0) offer(hop(identity, true));
	}

	const steps = new Map<string, Step>();
	const step = (made: Hop, basis: ConversionBasis) => {
		const key = `${routeKey([made])}:${basis}`;
		const held = steps.get(key);
		if (held) return held;
		const built = buildStep(
			database,
			made.crosswalks.map(crosswalk),
			basis,
			weights,
		);
		const result = made.reversed ? reverseStep(built) : built;
		steps.set(key, result);
		return result;
	};

	const routes = (fromRelease: number, toRelease: number, maxHops = 3) => {
		const found: Route[] = [];
		const target = release(toRelease).geography;
		const walk = (at: number, route: Route, left: Set<string>) => {
			if (at === toRelease) {
				if (route.length > 0) found.push(route);
				return;
			}
			if (route.length === maxHops) return;
			const here = release(at).geography;
			for (const next of outgoing.get(at) ?? []) {
				const there = release(next.toRelease).geography;
				// A route never returns to a release or to a geography it has
				// left, and leaves the target geography only by arriving.
				if (route.some((made) => made.fromRelease === next.toRelease))
					continue;
				if (there !== here && (left.has(there) || here === target))
					continue;
				walk(
					next.toRelease,
					[...route, next],
					there === here ? left : new Set([...left, here]),
				);
			}
		};
		walk(fromRelease, [], new Set());
		return found.sort(
			(a, b) =>
				a.length - b.length || routeKey(a).localeCompare(routeKey(b)),
		);
	};

	return { crosswalk, release, hop, step, routes };
};
