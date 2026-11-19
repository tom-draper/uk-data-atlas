import assert from "node:assert/strict";
import { test } from "vitest";
import { parseBenchmark, score } from "../../src/notional/benchmark.ts";
import { COVARIATES, fitLinear } from "../../src/notional/census.ts";
import {
	baseline,
	mainMethod,
	type Partition,
	type Piece,
} from "../../src/notional/estimate.ts";
import {
	shareAlikeLocal,
	type NotionalInputs,
} from "../../src/notional/inputs.ts";
import { parseScottishLocal } from "../../src/notional/scotland.ts";

const piece = (
	unit: number,
	old: number,
	target: number,
	adults: number,
): Piece => ({
	unit,
	ward: unit < 0 ? "W99" : "",
	old,
	new: target,
	residents: adults * 1.25,
	adults,
	covariates: new Float64Array(COVARIATES.length),
	covered: adults,
});

/** Old seat EA splits into X and Y; old seat EB goes whole into Y. */
const fixture = () => {
	const inputs = {
		oldSeats: { codes: ["EA", "EB"], area: new Int32Array() },
		newSeats: { codes: ["X", "Y"], area: new Int32Array() },
		general: new Map([
			["EA", { con: 600, lab: 400 }],
			["EB", { con: 300, lab: 700 }],
		]),
		names: new Map(),
	} as unknown as NotionalInputs;
	const pieces = [
		piece(0, 0, 0, 100),
		piece(1, 0, 1, 100),
		piece(-1, 1, 1, 200),
	];
	const parts: Partition = {
		units: [
			{
				period: "2019-05-02",
				release: "r",
				code: "W1",
				votes: { con: 80, lab: 20 },
			},
			{
				period: "2019-05-02",
				release: "r",
				code: "W2",
				votes: { con: 40, lab: 60 },
			},
		],
		pieces,
		bySeat: new Map([
			["EA", pieces.slice(0, 2)],
			["EB", pieces.slice(2)],
		]),
		changed: new Set(["X", "Y"]),
		split: new Set(["EA"]),
	};
	return { inputs, parts };
};

const total = (votes: Record<string, number>) =>
	Object.values(votes).reduce((s, v) => s + v, 0);

test("the baseline splits an old seat's votes by residents", () => {
	const { inputs, parts } = fixture();
	const { seats } = baseline(inputs, parts);
	assert.deepEqual(seats.get("X")!.votes, { con: 300, lab: 200 });
	assert.deepEqual(seats.get("Y")!.votes, { con: 600, lab: 900 });
	assert.deepEqual(seats.get("Y")!.atRisk, { con: 300, lab: 200 });
});

test("the main method keeps each old seat's votes and follows local strength", () => {
	const { inputs, parts } = fixture();
	for (const rake of [false, true]) {
		const { seats, pieceSources } = mainMethod(inputs, parts, {
			model: "within",
			ukipForBrexit: true,
			rake,
		});
		const x = seats.get("X")!.votes;
		const y = seats.get("Y")!.votes;
		assert.ok(Math.abs(x.con! + y.con! - 900) < 1e-6);
		assert.ok(Math.abs(x.lab! + y.lab! - 1100) < 1e-6);
		// W1 leans Conservative, so X gets more than its share of their vote.
		assert.ok(x.con! > 300 && x.lab! < 200);
		if (rake) assert.ok(Math.abs(total(x) - 500) < 1e-6);
		assert.equal(pieceSources.get(parts.pieces[2]!)!.con, "uniform");
		assert.equal(seats.get("X")!.sources.local, 1);
	}
});

test("scores share error per seat, by nation and by winner", () => {
	const csv = [
		"﻿Constituency geographic code,Main party abbreviation,Candidate vote count",
		"X,Con,250",
		"X,Lab,250",
		"Y,Con,600",
		"Y,Lab,850",
		'Y,"Ind",50',
	].join("\n");
	const benchmark = parseBenchmark(csv);
	assert.deepEqual(benchmark.get("Y"), { con: 600, lab: 850, other: 50 });
	const { inputs, parts } = fixture();
	const result = score(baseline(inputs, parts), benchmark, parts.changed);
	assert.equal(result.seats, 2);
	const x = result.perSeat.find((s) => s.code === "X")!;
	assert.ok(Math.abs(x.error - 10) < 1e-9);
	assert.equal(x.winner, "con");
	assert.ok(["con", "lab"].includes(x.benchmarkWinner));
	assert.ok(Math.abs(result.byParty.con!.bias - (10 + 0) / 2) < 1e-9);
});

test("fits weighted least squares", () => {
	const rows = [0, 1, 2, 3].map((x) => ({ x: [1, x], y: 2 + 3 * x, w: 1 }));
	const { beta, r2 } = fitLinear(rows, 0);
	assert.ok(Math.abs(beta[0]! - 2) < 1e-9 && Math.abs(beta[1]! - 3) < 1e-9);
	assert.ok(Math.abs(r2 - 1) < 1e-9);
});

test("sums Scottish first preferences by party and skips other nations", () => {
	const wards = parseScottishLocal(
		[
			`"Aberdeen","S12000033","Ward A","S13000001","A","SNP","900","1"`,
			`"Aberdeen","S12000033","Ward A","S13000001","B","SNP","600","1"`,
			`"Aberdeen","S12000033","Ward A","S13000001","C","C","1000","1"`,
			`"Aberdeen","S12000033","Ward A","S13000001","D","Sol","50","0"`,
			`"Leeds","E08000035","Ward B","E05000001","E","Lab","700","1"`,
		].join("\n"),
	);
	assert.deepEqual([...wards.keys()], ["S13000001"]);
	assert.deepEqual(wards.get("S13000001"), {
		snp: 1500,
		con: 1000,
		other: 50,
	});
});

test("local results from 2016 to 2019 carry a share-alike licence", () => {
	assert.equal(shareAlikeLocal("2015-05-07"), undefined);
	assert.equal(shareAlikeLocal("2016-05-05"), "cc-by-sa-3.0");
	assert.equal(shareAlikeLocal("2019-05-02"), "cc-by-sa-3.0");
	assert.equal(shareAlikeLocal("2021-05-06"), undefined);
});
