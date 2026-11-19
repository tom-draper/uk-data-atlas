import type { Placement } from "../../crosswalk-weights/weigh.ts";
import type { Votes } from "../inputs.ts";
import {
	isUsable,
	mainArea,
	MAX_YEARS,
	overlay,
	targets,
	years,
	type WardNotional,
} from "./estimate.ts";
import type { LocalInputs } from "./inputs.ts";

/**
 * There is no published benchmark of local notionals, so they are scored by
 * what they predict: a new ward's notional share plus its council's swing,
 * against the ward's actual result at the next election. The same is done for
 * wards whose boundaries did not change, from their own previous result, so
 * the year-to-year noise both share can be told apart from the notional's own
 * error.
 */

export const SCORED = ["con", "lab", "ld", "green", "ref"] as const;

export type Residual = {
	ward: string;
	release: string;
	party: string;
	/** Actual share less predicted, in points of a whole. */
	error: number;
	/** At-risk votes as a share of the notional total; 0 for an unchanged ward. */
	atRisk: number;
	years: number;
	changed: boolean;
};

const total = (votes: Votes) =>
	Object.values(votes).reduce((sum, value) => sum + value, 0);

/** The council release in force at a ward release: the latest not after it. */
export const councilFor = (inputs: LocalInputs, release: string): Placement => {
	const names = [...inputs.councils.keys()].sort();
	const name = names.filter((n) => n <= release).at(-1) ?? names[0]!;
	return inputs.councils.get(name)!;
};

type Prior = {
	code: string;
	council: number;
	prior: Votes;
	atRisk: Votes;
	actual: Votes;
	years: number;
	changed: boolean;
};

export const residuals = (
	inputs: LocalInputs,
	notionals: readonly WardNotional[],
): Residual[] => {
	const byKey = new Map(notionals.map((n) => [`${n.release}|${n.code}`, n]));
	const out: Residual[] = [];
	for (const target of targets(inputs)) {
		if (!target.period) continue;
		const at = inputs.elections.find((e) => e.period === target.period)!;
		const placement = inputs.wardsOf(target.release);
		const councilOf = mainArea(
			overlay(
				inputs.adults,
				placement,
				councilFor(inputs, target.release),
			),
		);
		const fresh = new Set(target.wards.map((i) => placement.codes[i]!));
		const earlier = inputs.elections
			.filter(
				(e) =>
					e.period < at.period &&
					years(e.period, at.period) <= MAX_YEARS,
			)
			.reverse();
		const rows: Prior[] = [];
		for (const [code, actual] of at.wards) {
			if (!isUsable(actual) || !councilOf.has(code)) continue;
			const council = councilOf.get(code)!;
			if (fresh.has(code)) {
				const notional = byKey.get(`${target.release}|${code}`);
				if (!notional) continue;
				rows.push({
					code,
					council,
					prior: notional.votes,
					atRisk: notional.atRisk,
					actual,
					years: years(notional.period, at.period),
					changed: true,
				});
				continue;
			}
			const previous = earlier.find((e) => isUsable(e.wards.get(code)));
			if (!previous) continue;
			rows.push({
				code,
				council,
				prior: previous.wards.get(code)!,
				atRisk: {},
				actual,
				years: years(previous.period, at.period),
				changed: false,
			});
		}
		const byCouncil = new Map<number, Prior[]>();
		for (const row of rows) {
			let list = byCouncil.get(row.council);
			if (!list) byCouncil.set(row.council, (list = []));
			list.push(row);
		}
		for (const list of byCouncil.values()) {
			if (list.length < 2) continue;
			const sums = (pick: (row: Prior) => Votes) => {
				const parties: Votes = {};
				let all = 0;
				for (const row of list) {
					const votes = pick(row);
					all += total(votes);
					for (const party of SCORED)
						parties[party] =
							(parties[party] ?? 0) + (votes[party] ?? 0);
				}
				return { parties, all };
			};
			const before = sums((row) => row.prior);
			const after = sums((row) => row.actual);
			for (const row of list) {
				const priorTotal = total(row.prior);
				const actualTotal = total(row.actual);
				for (const party of SCORED) {
					const p = row.prior[party] ?? 0;
					const a = row.actual[party] ?? 0;
					if (!(p > 0) || !(a > 0)) continue;
					// The council's swing, leaving the ward out.
					const swing =
						(after.parties[party]! - a) /
							(after.all - actualTotal) -
						(before.parties[party]! - p) /
							(before.all - priorTotal);
					out.push({
						ward: row.code,
						release: target.release,
						party,
						error: a / actualTotal - (p / priorTotal + swing),
						atRisk: (row.atRisk[party] ?? 0) / priorTotal,
						years: row.years,
						changed: row.changed,
					});
				}
			}
		}
	}
	return out;
};

/**
 * The notional's own error, apart from the year-to-year noise it shares with
 * every ward: across new wards scored at the same election from the same gap,
 * squared residuals against the at-risk share squared, so wards made whole
 * from old wards set the noise and split ones add their own error. Returns
 * the spread per at-risk share, and the 95% bound factor it implies.
 */
/**
 * The bound factor shipped: `calibrate` on the full build, measured by hand and
 * kept fixed so a rebuild does not move the bounds.
 */
export const LOCAL_BOUND_FACTOR = 0.23;

export const calibrate = (rows: readonly Residual[]) => {
	const groups = new Map<string, Residual[]>();
	for (const row of rows) {
		if (!row.changed) continue;
		const key = `${row.release}|${Math.round(row.years)}`;
		let list = groups.get(key);
		if (!list) groups.set(key, (list = []));
		list.push(row);
	}
	let xy = 0;
	let xx = 0;
	for (const list of groups.values()) {
		if (list.length < 30) continue;
		const meanX = list.reduce((s, r) => s + r.atRisk ** 2, 0) / list.length;
		const meanY = list.reduce((s, r) => s + r.error ** 2, 0) / list.length;
		for (const row of list) {
			xy += (row.atRisk ** 2 - meanX) * (row.error ** 2 - meanY);
			xx += (row.atRisk ** 2 - meanX) ** 2;
		}
	}
	const spread = Math.sqrt(Math.max(0, xy / xx));
	return { spread, factor: 1.96 * spread };
};

export const summarise = (rows: readonly Residual[]) => {
	const groups = new Map<string, number[]>();
	for (const row of rows) {
		const key = `${row.changed ? "new" : "same"} ${Math.round(row.years)}y`;
		let list = groups.get(key);
		if (!list) groups.set(key, (list = []));
		list.push(row.error);
	}
	return [...groups]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([group, errors]) => ({
			group,
			n: errors.length,
			rmse: Math.sqrt(
				errors.reduce((s, e) => s + e * e, 0) / errors.length,
			),
		}));
};
