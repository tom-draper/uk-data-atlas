import { COVARIATES, fitLinear, type Covariates } from "./census.ts";
import {
	GENERAL_DAY,
	OLD_SEATS,
	type NotionalInputs,
	type Votes,
} from "./inputs.ts";

/**
 * Notional 2019 general election results on the 2024 constituencies.
 *
 * The weight atoms (postcodes, each with a share of the census population) are
 * grouped into pieces: one local election unit (a ward, at the contest nearest
 * to the general election that it can be placed in), within one 2019 seat,
 * within one 2024 seat. Each old seat's actual votes are then spread over its
 * pieces, and the pieces summed into the new seats.
 */

/**
 * Bounds are the estimate plus or minus this share of the votes that came from
 * split old seats. Fitted on the 2024 benchmark: 95% of party estimates in
 * changed seats fell within it (in sample).
 */
export const BOUND_FACTOR = 0.32;

export const GENERAL_PARTIES = [
	"con",
	"lab",
	"ld",
	"snp",
	"pc",
	"green",
	"brx",
	"other",
] as const;
export type Party = (typeof GENERAL_PARTIES)[number];
/** Parties whose local candidates stand in for their general election vote. */
export const LOCAL_PARTIES = ["con", "lab", "ld", "green", "pc"] as const;

/**
 * Parties the within-seat model fills in for. Plaid Cymru and the Brexit
 * Party scored worse with it than with the seat average.
 */
export const MODELLED_PARTIES = ["con", "lab", "ld", "green"] as const;

export type Source = "local" | "model" | "uniform";
export type FallbackReason =
	"no local results held" | "no contest placed" | "contest unusable";

export type Unit = {
	period: string;
	release: string;
	code: string;
	votes: Votes;
};

export type Piece = {
	/** Index into `units`, or -1 when no usable contest covers it. */
	unit: number;
	/** The 2019 ward it lies in, for flagging pieces without a unit. */
	ward: string;
	old: number;
	new: number;
	residents: number;
	adults: number;
	/** Adult-weighted sum of covariates, and the adults it covers. */
	covariates: Float64Array;
	covered: number;
	fallback?: FallbackReason;
};

export type Partition = {
	units: Unit[];
	pieces: Piece[];
	/** Pieces by 2019 seat code. */
	bySeat: Map<string, Piece[]>;
	/** 2024 seats that are not one whole 2019 seat. */
	changed: Set<string>;
	/** Old seats split between more than one new seat. */
	split: Set<string>;
};

const isUsable = (votes: Votes) => {
	let total = 0;
	let main = 0;
	let standing = 0;
	for (const [party, value] of Object.entries(votes)) {
		total += value;
		if ((LOCAL_PARTIES as readonly string[]).includes(party)) {
			main += value;
			if (value > 0) standing++;
		}
	}
	return total > 0 && standing >= 2 && main / total >= 0.5;
};

const distance = (period: string) =>
	Math.abs(Date.parse(period) - Date.parse(GENERAL_DAY));

/** Group the atoms into pieces, choosing each atom's local unit a priori. */
export const partition = (
	inputs: NotionalInputs,
	covariates: Covariates,
): Partition => {
	const n = inputs.atoms;
	const sources = [...inputs.local].sort(
		(a, b) =>
			distance(a.period) - distance(b.period) ||
			b.wards.size - a.wards.size,
	);
	const units: Unit[] = [];
	const unitOf = new Int32Array(n).fill(-1);
	const contested = new Uint8Array(n);
	for (const source of sources) {
		const placement = inputs.wards.get(source.release)!;
		const index = placement.codes.map((code) => {
			const votes = source.wards.get(code);
			if (!votes) return -2;
			if (!isUsable(votes)) return -1;
			units.push({
				period: source.period,
				release: source.release,
				code,
				votes,
			});
			return units.length - 1;
		});
		for (let i = 0; i < n; i++) {
			const at = placement.area[i]!;
			if (unitOf[i]! >= 0 || at < 0) continue;
			const unit = index[at]!;
			if (unit >= 0) unitOf[i] = unit;
			else if (unit === -1) contested[i] = 1;
		}
	}
	const k = COVARIATES.length;
	const wards = inputs.wards.get(OLD_SEATS)!;
	const lsoa = inputs.lsoa.area;
	let adults = 0;
	let residents = 0;
	for (let l = 0; l < inputs.lsoa.codes.length; l++) {
		const share = covariates.adultShare[l]!;
		if (Number.isFinite(share)) {
			adults += share;
			residents += 1;
		}
	}
	const meanAdultShare = adults / residents;
	const byKey = new Map<string, Piece>();
	for (let i = 0; i < n; i++) {
		const old = inputs.oldSeats.area[i]!;
		const target = inputs.newSeats.area[i]!;
		const population = inputs.population[i]!;
		if (old < 0 || target < 0 || !(population > 0)) continue;
		const unit = unitOf[i]!;
		const wardAt = wards.area[i]!;
		const ward = wardAt >= 0 ? wards.codes[wardAt]! : "";
		const key = `${unit}|${unit < 0 ? ward : ""}|${old}|${target}`;
		let piece = byKey.get(key);
		if (!piece) {
			const seat = inputs.oldSeats.codes[old]!;
			piece = {
				unit,
				ward: unit >= 0 ? "" : ward,
				old,
				new: target,
				residents: 0,
				adults: 0,
				covariates: new Float64Array(k),
				covered: 0,
				fallback:
					unit >= 0
						? undefined
						: seat.startsWith("S")
							? "no local results held"
							: contested[i]
								? "contest unusable"
								: "no contest placed",
			};
			byKey.set(key, piece);
		}
		const l = lsoa[i]!;
		const share = l >= 0 ? covariates.adultShare[l]! : Number.NaN;
		const adult =
			population * (Number.isFinite(share) ? share : meanAdultShare);
		piece.residents += population;
		piece.adults += adult;
		if (l >= 0 && Number.isFinite(covariates.values[l * k]!)) {
			for (let c = 0; c < k; c++)
				piece.covariates[c]! += adult * covariates.values[l * k + c]!;
			piece.covered += adult;
		}
	}
	const pieces = [...byKey.values()];
	const bySeat = new Map<string, Piece[]>();
	const targets = new Map<number, Set<number>>();
	const origins = new Map<number, Set<number>>();
	for (const piece of pieces) {
		const seat = inputs.oldSeats.codes[piece.old]!;
		let list = bySeat.get(seat);
		if (!list) bySeat.set(seat, (list = []));
		list.push(piece);
		if (!targets.has(piece.old)) targets.set(piece.old, new Set());
		targets.get(piece.old)!.add(piece.new);
		if (!origins.has(piece.new)) origins.set(piece.new, new Set());
		origins.get(piece.new)!.add(piece.old);
	}
	const split = new Set(
		[...targets]
			.filter(([, set]) => set.size > 1)
			.map(([old]) => inputs.oldSeats.codes[old]!),
	);
	const changed = new Set(
		[...origins]
			.filter(
				([, set]) =>
					set.size > 1 ||
					split.has(inputs.oldSeats.codes[[...set][0]!]!),
			)
			.map(([target]) => inputs.newSeats.codes[target]!),
	);
	return { units, pieces, bySeat, changed, split };
};

export type SeatEstimate = {
	code: string;
	votes: Votes;
	/** Votes that came from old seats split between new seats. */
	atRisk: Votes;
	/** Of the at-risk votes, the share placed by each source. */
	sources: Record<Source, number>;
	origins: string[];
};

export type Estimate = {
	seats: Map<string, SeatEstimate>;
	/** Per piece and party, where its spread came from. */
	pieceSources: Map<Piece, Partial<Record<Party, Source>>>;
};

const collect = (
	inputs: NotionalInputs,
	parts: Partition,
	spread: (
		seat: string,
		pieces: Piece[],
	) => {
		votes: Partial<Record<Party, number>>[];
		sources: Partial<Record<Party, Source>>[];
	},
): Estimate => {
	const seats = new Map<string, SeatEstimate>();
	const pieceSources = new Map<Piece, Partial<Record<Party, Source>>>();
	for (const [seat, pieces] of parts.bySeat) {
		if (!inputs.general.has(seat)) continue;
		const atRisk = parts.split.has(seat);
		const result = spread(seat, pieces);
		pieces.forEach((piece, i) => {
			const code = inputs.newSeats.codes[piece.new]!;
			let target = seats.get(code);
			if (!target)
				seats.set(
					code,
					(target = {
						code,
						votes: {},
						atRisk: {},
						sources: { local: 0, model: 0, uniform: 0 },
						origins: [],
					}),
				);
			if (!target.origins.includes(seat)) target.origins.push(seat);
			pieceSources.set(piece, result.sources[i]!);
			for (const [party, value] of Object.entries(result.votes[i]!)) {
				target.votes[party] = (target.votes[party] ?? 0) + value;
				if (!atRisk) continue;
				target.atRisk[party] = (target.atRisk[party] ?? 0) + value;
				const source = result.sources[i]![party as Party] ?? "uniform";
				target.sources[source] += value;
			}
		});
	}
	for (const seat of seats.values()) {
		const total =
			seat.sources.local + seat.sources.model + seat.sources.uniform;
		if (total > 0)
			for (const source of ["local", "model", "uniform"] as const)
				seat.sources[source] /= total;
	}
	return { seats, pieceSources };
};

const partiesIn = (votes: Votes) =>
	GENERAL_PARTIES.filter((party) => (votes[party] ?? 0) > 0);

/** The baseline: each old seat's votes spread by residents, uniformly. */
export const baseline = (inputs: NotionalInputs, parts: Partition) =>
	collect(inputs, parts, (seat, pieces) => {
		const votes = inputs.general.get(seat)!;
		const total = pieces.reduce((s, p) => s + p.residents, 0);
		return {
			votes: pieces.map((piece) =>
				Object.fromEntries(
					partiesIn(votes).map((party) => [
						party,
						(votes[party]! * piece.residents) / total,
					]),
				),
			),
			sources: pieces.map(() => ({})),
		};
	});

export type ModelKind = "none" | "within";

export type MainOptions = {
	/** How pieces without a local share for a party are spread. */
	model: ModelKind;
	/** Use UKIP's local share for the Brexit Party. */
	ukipForBrexit: boolean;
	/** Rake pieces to adult totals as well as seats to party totals. */
	rake: boolean;
};

/**
 * Each part helped against the benchmark: see docs/notional-elections.md.
 */
export const DEFAULT_OPTIONS: MainOptions = {
	model: "within",
	ukipForBrexit: true,
	rake: true,
};

type Strengths = {
	/** A local strength per piece and party, on a scale comparable within a seat. */
	local: (piece: Piece, party: Party) => number | undefined;
	/** A modelled strength per piece and party, relative within the seat. */
	model: (
		pieces: Piece[],
		party: Party,
		seat: string,
	) => number[] | undefined;
	fits: Record<string, { rows: number; r2: number }>;
};

const covariateMean = (piece: Piece) =>
	Array.from(piece.covariates, (value) => value / piece.covered);

const localParty = (party: Party, options: MainOptions) =>
	party === "brx" && options.ukipForBrexit
		? "ukip"
		: (LOCAL_PARTIES as readonly string[]).includes(party)
			? party
			: undefined;

/**
 * Local shares, made comparable across years by scaling each party's local
 * vote in a year to its 2019 general election vote in England and Wales.
 */
const strengths = (
	inputs: NotionalInputs,
	parts: Partition,
	options: MainOptions,
): Strengths => {
	const national: Votes = {};
	for (const [seat, votes] of inputs.general)
		if (seat.startsWith("E") || seat.startsWith("W"))
			for (const [party, value] of Object.entries(votes))
				national[party] = (national[party] ?? 0) + value;
	national.ukip = national.brx ?? 0;
	const yearly = new Map<string, Votes>();
	for (const unit of parts.units) {
		let totals = yearly.get(unit.period);
		if (!totals) yearly.set(unit.period, (totals = {}));
		for (const [party, value] of Object.entries(unit.votes))
			totals[party] = (totals[party] ?? 0) + value;
	}
	const scale = (period: string, party: string) =>
		(national[party] ?? 0) / (yearly.get(period)![party] || 1);
	const shares = parts.units.map((unit) => {
		const scaled: Votes = {};
		let total = 0;
		for (const party of [...LOCAL_PARTIES, "ukip"]) {
			const value = (unit.votes[party] ?? 0) * scale(unit.period, party);
			scaled[party] = value;
			if (party !== "ukip") total += value;
		}
		for (const party of Object.keys(scaled)) scaled[party]! /= total;
		return scaled;
	});
	const local = (piece: Piece, party: Party) => {
		if (piece.unit < 0) return undefined;
		const name = localParty(party, options);
		const value = name ? shares[piece.unit]![name] : undefined;
		return value !== undefined && value > 0 ? value : undefined;
	};
	const fits: Strengths["fits"] = {};
	const k = COVARIATES.length;
	const coveredSeat = (pieces: readonly Piece[]) =>
		pieces.every((piece) => piece.covered / piece.adults > 0.99);

	if (options.model === "within") {
		// Within each seat, the log of a piece's local share over the seat's
		// average, against how far its covariates are from the seat's average.
		const betas = new Map<Party, number[]>();
		for (const party of MODELLED_PARTIES) {
			const rows: { x: number[]; y: number; w: number }[] = [];
			for (const pieces of parts.bySeat.values()) {
				const known = pieces.filter(
					(p) =>
						local(p, party) !== undefined &&
						p.covered / p.adults > 0.99,
				);
				if (known.length < 2) continue;
				const adults = known.reduce((s, p) => s + p.adults, 0);
				const meanX = new Array<number>(k).fill(0);
				let meanY = 0;
				for (const piece of known) {
					const x = covariateMean(piece);
					for (let c = 0; c < k; c++)
						meanX[c]! += (x[c]! * piece.adults) / adults;
					meanY +=
						(Math.log(local(piece, party)!) * piece.adults) /
						adults;
				}
				for (const piece of known) {
					const x = covariateMean(piece);
					rows.push({
						x: x.map((v, c) => v - meanX[c]!),
						y: Math.log(local(piece, party)!) - meanY,
						w: piece.adults,
					});
				}
			}
			if (rows.length < 50) continue;
			const fit = fitLinear(rows, 1e-4);
			betas.set(party, fit.beta);
			fits[party] = { rows: fit.rows, r2: fit.r2 };
		}
		return {
			local,
			fits,
			model: (pieces, party) => {
				const beta = betas.get(party);
				if (!beta || !coveredSeat(pieces)) return undefined;
				const adults = pieces.reduce((s, p) => s + p.adults, 0);
				const meanX = new Array<number>(k).fill(0);
				for (const piece of pieces) {
					const x = covariateMean(piece);
					for (let c = 0; c < k; c++)
						meanX[c]! += (x[c]! * piece.adults) / adults;
				}
				const relative = pieces.map((piece) =>
					Math.exp(
						covariateMean(piece).reduce(
							(s, v, c) => s + (v - meanX[c]!) * beta[c]!,
							0,
						),
					),
				);
				const mean =
					relative.reduce((s, v, i) => s + v * pieces[i]!.adults, 0) /
					adults;
				return relative.map((value) => value / mean);
			},
		};
	}
	return { local, fits, model: () => undefined };
};

/**
 * The main method. Within each old seat, a party's vote in a piece is taken
 * as proportional to adults times its relative strength there: its local
 * share over the seat's average where a local contest covers the piece and
 * the party stood, else the census model's relative strength, else the seat's
 * average. The pieces are then raked so each party sums to its actual vote
 * in the old seat (and, with `rake`, each piece's total follows its adults).
 */
export const mainMethod = (
	inputs: NotionalInputs,
	parts: Partition,
	options: MainOptions = DEFAULT_OPTIONS,
) => {
	const strength = strengths(inputs, parts, options);
	const estimate = collect(inputs, parts, (seat, pieces) => {
		const votes = inputs.general.get(seat)!;
		const parties = partiesIn(votes);
		const seed = pieces.map(() => ({}) as Partial<Record<Party, number>>);
		const sources = pieces.map(
			() => ({}) as Partial<Record<Party, Source>>,
		);
		for (const party of parties) {
			const local = pieces.map((piece) => strength.local(piece, party));
			const model = strength.model(pieces, party, seat);
			// Local shares are relative to the average of the pieces they
			// cover; the model says how those pieces sit against the whole seat.
			let localSum = 0;
			let localAdults = 0;
			let modelSum = 0;
			pieces.forEach((piece, i) => {
				if (local[i] === undefined) return;
				localSum += piece.adults * local[i]!;
				localAdults += piece.adults;
				if (model) modelSum += piece.adults * model[i]!;
			});
			const localMean = localAdults ? localSum / localAdults : 1;
			const coveredLevel =
				model && localAdults ? modelSum / localAdults : 1;
			pieces.forEach((piece, i) => {
				let relative: number;
				if (local[i] !== undefined) {
					relative = (local[i]! / localMean) * coveredLevel;
					sources[i]![party] = "local";
				} else if (model) {
					relative = model[i]!;
					sources[i]![party] = "model";
				} else {
					relative = 1;
					sources[i]![party] = "uniform";
				}
				seed[i]![party] = piece.adults * relative;
			});
		}
		const fitParties = () => {
			for (const party of parties) {
				const total = seed.reduce((s, o) => s + o[party]!, 0);
				for (const o of seed)
					o[party] = (o[party]! * votes[party]!) / total;
			}
		};
		if (options.rake) {
			const valid = parties.reduce((s, p) => s + votes[p]!, 0);
			const adults = pieces.reduce((s, p) => s + p.adults, 0);
			for (let iteration = 0; iteration < 50; iteration++) {
				fitParties();
				pieces.forEach((piece, i) => {
					const total = parties.reduce((s, p) => s + seed[i]![p]!, 0);
					const target = (valid * piece.adults) / adults;
					for (const party of parties)
						seed[i]![party] = (seed[i]![party]! * target) / total;
				});
			}
		}
		fitParties();
		return { votes: seed, sources };
	});
	return { ...estimate, fits: strength.fits };
};
