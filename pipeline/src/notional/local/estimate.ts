import type { Placement } from "../../crosswalk-weights/weigh.ts";
import type { Votes } from "../inputs.ts";
import type { Election, LocalInputs } from "./inputs.ts";

/**
 * Local election notionals: the result each ward created by a boundary review
 * would have had at the latest election before it, from the old wards it was
 * drawn from. See docs/notional-elections.md.
 */

/** A slice of an old ward under this share of its adults is boundary drift. */
export const SNAP = 0.02;
/** A new ward needs this share of its adults in old wards with a result. */
export const MIN_COVERAGE = 0.9;
/** The latest previous election is used, if no further back than this. */
export const MAX_YEARS = 4.5;
/** Notionals for the latest wards are as of the next polling day. */
export const NEXT_POLL = "2026-05-07";

export type Piece = {
	old: number;
	new: number;
	adults: number;
	/** Share of the old ward's adults, after drift is snapped. */
	fraction: number;
	/** Adults in the whole old ward. */
	wardAdults: number;
};

export type Overlay = {
	from: Placement;
	to: Placement;
	byOld: Map<number, Piece[]>;
	byNew: Map<number, Piece[]>;
};

const largest = (pieces: Piece[]) =>
	pieces.reduce((a, b) => (b.adults > a.adults ? b : a));

/**
 * Every (old area, new area) piece by adults. A piece under `SNAP` of its old
 * area is drift between two drawings of the same line, and joins the old
 * area's largest piece.
 */
export const overlay = (
	adults: Float64Array,
	from: Placement,
	to: Placement,
): Overlay => {
	const pieces = new Map<number, Piece>();
	const width = to.codes.length + 1;
	for (let i = 0; i < from.area.length; i++) {
		const o = from.area[i]!;
		if (o < 0 || !(adults[i]! > 0)) continue;
		const n = to.area[i]!;
		const key = o * width + n + 1;
		let piece = pieces.get(key);
		if (!piece)
			pieces.set(
				key,
				(piece = {
					old: o,
					new: n,
					adults: 0,
					fraction: 0,
					wardAdults: 0,
				}),
			);
		piece.adults += adults[i]!;
	}
	const byOld = new Map<number, Piece[]>();
	const byNew = new Map<number, Piece[]>();
	for (const piece of pieces.values()) {
		let list = byOld.get(piece.old);
		if (!list) byOld.set(piece.old, (list = []));
		list.push(piece);
	}
	for (const list of byOld.values()) {
		const total = list.reduce((s, p) => s + p.adults, 0);
		const main = largest(list);
		for (const piece of list) {
			piece.wardAdults = total;
			const share = piece.adults / total;
			if (share < SNAP && piece !== main) main.fraction += share;
			else piece.fraction += share;
		}
		for (const piece of list) {
			if (piece.fraction === 0 || piece.new < 0) continue;
			let into = byNew.get(piece.new);
			if (!into) byNew.set(piece.new, (into = []));
			into.push(piece);
		}
	}
	return { from, to, byOld, byNew };
};

/** The new area holding most of each old area's adults, by old code. */
export const mainArea = (layer: Overlay) => {
	const out = new Map<string, number>();
	for (const [o, pieces] of layer.byOld) {
		const main = largest(pieces);
		if (main.new >= 0) out.set(layer.from.codes[o]!, main.new);
	}
	return out;
};

/** A result worth building on: at least two parties with votes. */
export const isUsable = (votes: Votes | undefined): votes is Votes =>
	votes !== undefined &&
	Object.values(votes).filter((value) => value > 0).length >= 2;

export type WardNotional = {
	code: string;
	/** The election the notional result is for. */
	period: string;
	/** The ward release of the new ward. */
	release: string;
	/** The ward release of the old wards. */
	from: string;
	votes: Votes;
	/** Votes from old wards split between new wards, or scaled up. */
	atRisk: Votes;
	/** Share of the ward's adults in old wards with a usable result. */
	coverage: number;
	origins: string[];
	shareAlike?: string;
};

export const years = (from: string, to: string) =>
	(Date.parse(to) - Date.parse(from)) / (365.25 * 86_400_000);

/**
 * A new ward's notional result at one election: each old ward's votes spread
 * by adults, summed over the old wards it takes from, and scaled up by its
 * coverage. Undefined when coverage is under `MIN_COVERAGE`.
 */
export const notionalAt = (
	election: Election,
	layer: Overlay,
	ward: number,
): Omit<WardNotional, "release"> | undefined => {
	const pieces = layer.byNew.get(ward);
	if (!pieces) return undefined;
	let all = 0;
	let used = 0;
	const votes: Votes = {};
	const whole: Votes = {};
	const origins: string[] = [];
	for (const piece of pieces) {
		const adults = piece.fraction * piece.wardAdults;
		all += adults;
		const code = layer.from.codes[piece.old]!;
		const result = election.wards.get(code);
		if (!isUsable(result)) continue;
		used += adults;
		origins.push(code);
		for (const [party, value] of Object.entries(result)) {
			if (!(value > 0)) continue;
			votes[party] = (votes[party] ?? 0) + value * piece.fraction;
			if (piece.fraction > 0.999)
				whole[party] = (whole[party] ?? 0) + value * piece.fraction;
		}
	}
	const coverage = all > 0 ? used / all : 0;
	if (coverage < MIN_COVERAGE) return undefined;
	const atRisk: Votes = {};
	for (const party of Object.keys(votes)) {
		votes[party]! /= coverage;
		const risk = votes[party]! - (whole[party] ?? 0);
		atRisk[party] = risk > 1e-6 ? risk : 0;
	}
	return {
		code: layer.to.codes[ward]!,
		period: election.period,
		from: election.release,
		votes,
		atRisk,
		coverage,
		origins: origins.sort(),
		shareAlike: election.shareAlike,
	};
};

export type Target = {
	release: string;
	/** The election held on the release, if any. */
	period?: string;
	/** Indexes of the wards first seen on this release. */
	wards: number[];
};

/**
 * The ward releases notionals are made for, each with the wards first seen
 * on it: every release an election is published on after the first, and the
 * latest release.
 */
export const targets = (inputs: LocalInputs): Target[] => {
	const releases = [
		...new Set([
			...inputs.elections.map((election) => election.release),
			inputs.latest,
		]),
	];
	return releases.slice(1).map((release, i) => {
		const seen = new Set(inputs.wardsOf(releases[i]!).codes);
		return {
			release,
			period: inputs.elections.find((e) => e.release === release)?.period,
			wards: inputs
				.wardsOf(release)
				.codes.flatMap((code, index) =>
					seen.has(code) ? [] : [index],
				),
		};
	});
};

/**
 * Each target's new wards, from the latest previous election, within
 * `MAX_YEARS`, that covers them.
 */
export const notionals = (inputs: LocalInputs): WardNotional[] => {
	const layers = new Map<string, Overlay>();
	const layer = (from: string, to: string) => {
		const key = `${from}|${to}`;
		let found = layers.get(key);
		if (!found)
			layers.set(
				key,
				(found = overlay(
					inputs.adults,
					inputs.wardsOf(from),
					inputs.wardsOf(to),
				)),
			);
		return found;
	};
	const out: WardNotional[] = [];
	for (const target of targets(inputs)) {
		const before = target.period ?? NEXT_POLL;
		const earlier = inputs.elections
			.filter(
				(e) =>
					e.period < before &&
					e.release !== target.release &&
					years(e.period, before) <= MAX_YEARS,
			)
			.reverse();
		for (const ward of target.wards)
			for (const election of earlier) {
				const found = notionalAt(
					election,
					layer(election.release, target.release),
					ward,
				);
				if (!found) continue;
				out.push({ ...found, release: target.release });
				break;
			}
	}
	return out;
};
