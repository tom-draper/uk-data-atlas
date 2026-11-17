import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Score } from "./benchmark.ts";
import {
	BOUND_FACTOR,
	GENERAL_PARTIES,
	type Estimate,
	type Partition,
} from "./estimate.ts";
import {
	CENSUS_DATASETS,
	GENERAL_DAY,
	NEW_SEATS,
	OLD_SEATS,
	type NotionalInputs,
} from "./inputs.ts";

export const notionalDirectory = (root: string) =>
	join(root, "data/build/notional-elections");

/** The estimates, with bounds, flags and inputs. A build output, not shipped. */
export const notionalPath = (root: string) =>
	join(notionalDirectory(root), "notional-elections.sqlite");

/** The accuracy tables as markdown, for `docs/notional-elections.md`. */
export const notionalTablesPath = (root: string) =>
	join(notionalDirectory(root), "notional-elections.md");

const SCHEMA = `
CREATE TABLE notional_input (
	role TEXT NOT NULL,
	key TEXT NOT NULL,
	PRIMARY KEY (role, key)
);
CREATE TABLE notional_estimate (
	method TEXT NOT NULL,
	seat TEXT NOT NULL,
	name TEXT,
	party TEXT NOT NULL,
	period TEXT NOT NULL,
	value REAL NOT NULL,
	lower REAL NOT NULL,
	upper REAL NOT NULL,
	-- derived: the seat is one or more whole 2019 seats, so its votes are exact.
	-- estimated: some votes came from 2019 seats split between new seats.
	status TEXT NOT NULL CHECK (status IN ('derived', 'estimated')),
	at_risk REAL NOT NULL,
	origins TEXT NOT NULL,
	PRIMARY KEY (method, seat, party)
);
CREATE TABLE notional_seat_source (
	method TEXT NOT NULL,
	seat TEXT NOT NULL,
	local REAL NOT NULL,
	model REAL NOT NULL,
	uniform REAL NOT NULL,
	PRIMARY KEY (method, seat)
);
CREATE TABLE notional_piece (
	old_seat TEXT NOT NULL,
	new_seat TEXT NOT NULL,
	residents REAL NOT NULL,
	adults REAL NOT NULL,
	unit_release TEXT,
	unit_ward TEXT,
	unit_period TEXT,
	fallback_ward TEXT,
	fallback TEXT,
	model_parties TEXT NOT NULL,
	uniform_parties TEXT NOT NULL
);
CREATE TABLE notional_score (
	method TEXT NOT NULL,
	scope TEXT NOT NULL,
	name TEXT NOT NULL,
	seats INTEGER NOT NULL,
	mae REAL NOT NULL,
	bias REAL,
	PRIMARY KEY (method, scope, name)
);
CREATE TABLE notional_seat_score (
	method TEXT NOT NULL,
	seat TEXT NOT NULL,
	error REAL NOT NULL,
	worst_party TEXT NOT NULL,
	worst_error REAL NOT NULL,
	winner TEXT NOT NULL,
	benchmark_winner TEXT NOT NULL,
	changed INTEGER NOT NULL,
	PRIMARY KEY (method, seat)
);
`;

export type StoredMethod = {
	method: string;
	estimate: Estimate;
	score?: Score;
};

const pp = (value: number) => value.toFixed(2);

/** The accuracy tables, as markdown. */
export const accuracyMarkdown = (
	inputs: NotionalInputs,
	methods: readonly StoredMethod[],
	label: (method: string) => string,
	worstOf: string,
) => {
	const scored = methods.filter((m) => m.score);
	if (!scored.length) return "No benchmark given, so nothing is scored.\n";
	const lines: string[] = [];
	const row = (cells: (string | number)[]) =>
		lines.push(`| ${cells.join(" | ")} |`);
	const header = (cells: string[]) => {
		row(cells);
		row(cells.map(() => "---"));
	};
	header([
		"Method",
		"MAE, all seats",
		"MAE, changed seats",
		"Winners differ",
	]);
	for (const { method, score } of scored)
		row([
			label(method),
			pp(score!.mae),
			pp(score!.changedMae),
			score!.winnersDiffer,
		]);
	lines.push("");
	const nations = Object.keys(scored[0]!.score!.byNation);
	header([
		"Method",
		...nations.map((n) => `${n} (${scored[0]!.score!.byNation[n]!.seats})`),
	]);
	for (const { method, score } of scored)
		row([
			label(method),
			...nations.map((n) => pp(score!.byNation[n]!.mae)),
		]);
	lines.push("");
	const parties = GENERAL_PARTIES.filter((p) => scored[0]!.score!.byParty[p]);
	header(["Method", ...parties]);
	for (const { method, score } of scored)
		row([
			label(method),
			...parties.map(
				(p) =>
					`${pp(score!.byParty[p]!.mae)} (${score!.byParty[p]!.bias >= 0 ? "+" : ""}${pp(score!.byParty[p]!.bias)})`,
			),
		]);
	lines.push("");
	const worst = methods.find((m) => m.method === worstOf);
	if (worst?.score) {
		header([
			"Seat",
			"MAE",
			"Largest error",
			"Winner",
			"From",
			"Local, model, uniform",
		]);
		for (const seat of [...worst.score.perSeat]
			.sort((a, b) => b.error - a.error)
			.slice(0, 20)) {
			const estimate = worst.estimate.seats.get(seat.code)!;
			row([
				`${inputs.names.get(seat.code) ?? seat.code}`,
				pp(seat.error),
				`${seat.worst.party} ${pp(seat.worst.error)}`,
				seat.winner === seat.benchmarkWinner
					? seat.winner
					: `${seat.winner}, benchmark ${seat.benchmarkWinner}`,
				estimate.origins
					.map((code) => inputs.names.get(code) ?? code)
					.join(", "),
				(["local", "model", "uniform"] as const)
					.map((s) => `${Math.round(100 * estimate.sources[s])}%`)
					.join(", "),
			]);
		}
	}
	return `${lines.join("\n")}\n`;
};

export const writeNotional = (
	root: string,
	inputs: NotionalInputs,
	parts: Partition,
	methods: readonly StoredMethod[],
	main: StoredMethod,
	markdown: string,
) => {
	mkdirSync(notionalDirectory(root), { recursive: true });
	const path = notionalPath(root);
	rmSync(path, { force: true });
	const database = new DatabaseSync(path);
	try {
		database.exec(SCHEMA);
		database.exec("BEGIN");
		const input = database.prepare(
			"INSERT INTO notional_input (role, key) VALUES (?, ?)",
		);
		for (const key of inputs.generalKeys)
			input.run("general election", key);
		for (const source of inputs.local)
			for (const key of source.keys)
				input.run(`local election ${source.period}`, key);
		for (const key of inputs.censusKeys) input.run("census 2021", key);
		input.run(
			"weights",
			`weight-atoms population, ${OLD_SEATS} to ${NEW_SEATS}`,
		);
		input.run("census datasets", CENSUS_DATASETS.join(", "));

		const estimate = database.prepare(
			`INSERT INTO notional_estimate (method, seat, name, party, period, value, lower, upper, status, at_risk, origins)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		);
		const source = database.prepare(
			"INSERT INTO notional_seat_source (method, seat, local, model, uniform) VALUES (?, ?, ?, ?, ?)",
		);
		const scoreRow = database.prepare(
			"INSERT INTO notional_score (method, scope, name, seats, mae, bias) VALUES (?, ?, ?, ?, ?, ?)",
		);
		const seatScore = database.prepare(
			`INSERT INTO notional_seat_score (method, seat, error, worst_party, worst_error, winner, benchmark_winner, changed)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		);
		for (const { method, estimate: result, score } of methods) {
			for (const seat of result.seats.values()) {
				const status = parts.changed.has(seat.code)
					? "estimated"
					: "derived";
				for (const [party, value] of Object.entries(seat.votes)) {
					const risk = seat.atRisk[party] ?? 0;
					estimate.run(
						method,
						seat.code,
						inputs.names.get(seat.code) ?? null,
						party,
						GENERAL_DAY,
						value,
						Math.max(0, value - BOUND_FACTOR * risk),
						value + BOUND_FACTOR * risk,
						status,
						risk,
						seat.origins.join(","),
					);
				}
				source.run(
					method,
					seat.code,
					seat.sources.local,
					seat.sources.model,
					seat.sources.uniform,
				);
			}
			if (!score) continue;
			scoreRow.run(method, "all", "all", score.seats, score.mae, null);
			scoreRow.run(
				method,
				"changed",
				"changed",
				score.changedSeats,
				score.changedMae,
				null,
			);
			scoreRow.run(
				method,
				"winners differ",
				"winners differ",
				score.winnersDiffer,
				0,
				null,
			);
			for (const [nation, value] of Object.entries(score.byNation))
				scoreRow.run(
					method,
					"nation",
					nation,
					value.seats,
					value.mae,
					null,
				);
			for (const [party, value] of Object.entries(score.byParty))
				scoreRow.run(
					method,
					"party",
					party,
					value.seats,
					value.mae,
					value.bias,
				);
			for (const seat of score.perSeat)
				seatScore.run(
					method,
					seat.code,
					seat.error,
					seat.worst.party,
					seat.worst.error,
					seat.winner,
					seat.benchmarkWinner,
					seat.changed ? 1 : 0,
				);
		}

		const piece = database.prepare(
			`INSERT INTO notional_piece (old_seat, new_seat, residents, adults, unit_release, unit_ward, unit_period, fallback_ward, fallback, model_parties, uniform_parties)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		);
		for (const p of parts.pieces) {
			const unit = p.unit >= 0 ? parts.units[p.unit]! : undefined;
			const sources = main.estimate.pieceSources.get(p) ?? {};
			const by = (wanted: string) =>
				Object.entries(sources)
					.filter(([, s]) => s === wanted)
					.map(([party]) => party)
					.join(",");
			piece.run(
				inputs.oldSeats.codes[p.old]!,
				inputs.newSeats.codes[p.new]!,
				p.residents,
				p.adults,
				unit?.release ?? null,
				unit?.code ?? null,
				unit?.period ?? null,
				unit ? null : p.ward || null,
				p.fallback ?? null,
				by("model"),
				by("uniform"),
			);
		}
		database.exec("COMMIT");
	} finally {
		database.close();
	}
	writeFileSync(notionalTablesPath(root), markdown);
	return path;
};
