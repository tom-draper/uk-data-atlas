import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { GENERAL_PARTIES, type Estimate, type Party } from "./estimate.ts";
import type { Votes } from "./inputs.ts";

/**
 * Scoring against the published 2019 notionals on the 2024 seats (Rallings
 * and Thrasher, republished by the House of Commons Library). Those figures
 * are third party: they are read from a local file to score against, never
 * stored or shipped.
 */

const ABBREVIATIONS: Record<string, Party> = {
	Con: "con",
	Lab: "lab",
	LD: "ld",
	SNP: "snp",
	PC: "pc",
	Green: "green",
	BRX: "brx",
};

/** Votes by party per 2024 seat from the Commons Library candidacies CSV. */
export const parseBenchmark = (text: string) => {
	const { data } = Papa.parse<Record<string, string>>(
		text.replace(/^\uFEFF/, ""),
		{
			header: true,
			skipEmptyLines: true,
		},
	);
	const seats = new Map<string, Votes>();
	for (const row of data) {
		const seat = row["Constituency geographic code"];
		const votes = Number(row["Candidate vote count"]);
		if (!seat || !Number.isFinite(votes))
			throw new Error(
				"Benchmark rows need a constituency code and a vote count",
			);
		const name =
			ABBREVIATIONS[row["Main party abbreviation"] ?? ""] ?? "other";
		let found = seats.get(seat);
		if (!found) seats.set(seat, (found = {}));
		found[name] = (found[name] ?? 0) + votes;
	}
	return seats;
};

export const readBenchmark = (path: string) =>
	parseBenchmark(readFileSync(path, "utf8"));

const shares = (votes: Votes) => {
	const total = Object.values(votes).reduce((s, v) => s + v, 0);
	return Object.fromEntries(
		GENERAL_PARTIES.map((party) => [party, (votes[party] ?? 0) / total]),
	) as Record<Party, number>;
};

const winner = (votes: Votes) =>
	Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0];

export type SeatScore = {
	code: string;
	/** Mean absolute share error, percentage points, over the parties in either. */
	error: number;
	/** Largest single party share error, percentage points. */
	worst: { party: Party; error: number };
	winner: string;
	benchmarkWinner: string;
	changed: boolean;
};

export type Score = {
	seats: number;
	mae: number;
	changedSeats: number;
	changedMae: number;
	winnersDiffer: number;
	byNation: Record<string, { seats: number; mae: number }>;
	/** Mean absolute share error and mean signed error (bias), per party. */
	byParty: Record<string, { seats: number; mae: number; bias: number }>;
	perSeat: SeatScore[];
};

const NATIONS: Record<string, string> = {
	E: "England",
	W: "Wales",
	S: "Scotland",
};

const mean = (values: number[]) =>
	values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;

export const score = (
	estimate: Estimate,
	benchmark: Map<string, Votes>,
	changed: Set<string>,
): Score => {
	const perSeat: SeatScore[] = [];
	const byParty = new Map<string, { abs: number[]; signed: number[] }>();
	for (const [code, seat] of estimate.seats) {
		const actual = benchmark.get(code);
		if (!actual) continue;
		const ours = shares(seat.votes);
		const theirs = shares(actual);
		const errors: { party: Party; error: number }[] = [];
		for (const party of GENERAL_PARTIES) {
			if (!(ours[party] > 0) && !(theirs[party] > 0)) continue;
			const signed = 100 * (ours[party] - theirs[party]);
			errors.push({ party, error: Math.abs(signed) });
			let entry = byParty.get(party);
			if (!entry) byParty.set(party, (entry = { abs: [], signed: [] }));
			entry.abs.push(Math.abs(signed));
			entry.signed.push(signed);
		}
		const worst = errors.reduce((a, b) => (b.error > a.error ? b : a));
		perSeat.push({
			code,
			error: mean(errors.map((e) => e.error)),
			worst,
			winner: winner(seat.votes)!,
			benchmarkWinner: winner(actual)!,
			changed: changed.has(code),
		});
	}
	const changedSeats = perSeat.filter((s) => s.changed);
	const byNation: Score["byNation"] = {};
	for (const [prefix, nation] of Object.entries(NATIONS)) {
		const list = perSeat.filter((s) => s.code.startsWith(prefix));
		if (list.length)
			byNation[nation] = {
				seats: list.length,
				mae: mean(list.map((s) => s.error)),
			};
	}
	return {
		seats: perSeat.length,
		mae: mean(perSeat.map((s) => s.error)),
		changedSeats: changedSeats.length,
		changedMae: mean(changedSeats.map((s) => s.error)),
		winnersDiffer: perSeat.filter((s) => s.winner !== s.benchmarkWinner)
			.length,
		byNation,
		byParty: Object.fromEntries(
			[...byParty].map(([party, { abs, signed }]) => [
				party,
				{ seats: abs.length, mae: mean(abs), bias: mean(signed) },
			]),
		),
		perSeat,
	};
};
