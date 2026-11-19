import assert from "node:assert/strict";
import { test } from "vitest";
import type { Placement } from "../../src/crosswalk-weights/weigh.ts";
import { calibrate, type Residual } from "../../src/notional/local/backtest.ts";
import {
	notionalAt,
	notionals,
	overlay,
} from "../../src/notional/local/estimate.ts";
import type { Election, LocalInputs } from "../../src/notional/local/inputs.ts";

// Old wards A (atoms 0 to 2) and B (3 to 5); new wards X and Y. Atom 5 is a
// sliver of B drawn into X, boundary drift.
const adults = new Float64Array([10, 10, 10, 10, 10, 0.1]);
const old: Placement = {
	codes: ["A", "B"],
	area: Int32Array.from([0, 0, 0, 1, 1, 1]),
};
const fresh: Placement = {
	codes: ["X", "Y"],
	area: Int32Array.from([0, 0, 1, 1, 1, 0]),
};

const election = (wards: Record<string, Record<string, number>>): Election => ({
	period: "2022-05-05",
	release: "r1",
	wards: new Map(Object.entries(wards)),
	keys: [],
});

const close = (
	actual: Record<string, number>,
	expected: Record<string, number>,
) => {
	assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
	for (const [party, value] of Object.entries(expected))
		assert.ok(
			Math.abs(actual[party]! - value) < 1e-9,
			`${party}: ${actual[party]} not ${value}`,
		);
};

test("a sliver under the snap share joins its old ward's largest piece", () => {
	const layer = overlay(adults, old, fresh);
	const b = layer.byOld.get(1)!;
	assert.equal(b.find((p) => p.new === 0)!.fraction, 0);
	assert.ok(Math.abs(b.find((p) => p.new === 1)!.fraction - 1) < 1e-9);
	assert.deepEqual(
		layer.byNew.get(0)!.map((p) => p.old),
		[0],
	);
});

test("old ward votes are spread by adults, and only split wards are at risk", () => {
	const layer = overlay(adults, old, fresh);
	const result = election({
		A: { con: 30, lab: 60 },
		B: { con: 20, lab: 10 },
	});
	const x = notionalAt(result, layer, 0)!;
	close(x.votes, { con: 20, lab: 40 });
	close(x.atRisk, { con: 20, lab: 40 });
	assert.deepEqual(x.origins, ["A"]);
	const y = notionalAt(result, layer, 1)!;
	close(y.votes, { con: 30, lab: 30 });
	close(y.atRisk, { con: 10, lab: 20 });
	assert.equal(y.coverage, 1);
});

test("a ward of whole old wards has nothing at risk", () => {
	const same: Placement = {
		codes: ["P", "Q"],
		area: Int32Array.from([0, 0, 0, 1, 1, 1]),
	};
	const found = notionalAt(
		election({ A: { con: 30, lab: 60 }, B: { con: 20, lab: 10 } }),
		overlay(adults, old, same),
		1,
	)!;
	close(found.atRisk, { con: 0, lab: 0 });
});

test("a ward mostly in old wards with no usable result has no notional", () => {
	const layer = overlay(adults, old, fresh);
	const result = election({ A: { con: 30, lab: 60 }, B: { con: 20 } });
	assert.equal(notionalAt(result, layer, 1), undefined);
	assert.ok(notionalAt(result, layer, 0));
});

test("each new ward takes the latest election within reach", () => {
	const wards = new Map([
		["r1", old],
		["r2", fresh],
	]);
	const inputs = {
		adults,
		elections: [
			{
				...election({ A: { con: 1, lab: 2 }, B: { con: 3, lab: 4 } }),
				period: "2017-05-04",
			},
			election({ A: { con: 30, lab: 60 }, B: { con: 20, lab: 10 } }),
		],
		latest: "r2",
		wardsOf: (release: string) => wards.get(release)!,
	} as unknown as LocalInputs;
	const found = notionals(inputs);
	assert.deepEqual(
		found.map((n) => [n.code, n.release, n.from, n.period]),
		[
			["X", "r2", "r1", "2022-05-05"],
			["Y", "r2", "r1", "2022-05-05"],
		],
	);
	// 2017 is over 4.5 years before the next poll.
	inputs.elections.pop();
	assert.deepEqual(notionals(inputs), []);
});

test("the bound factor is 1.96 times the spread per at-risk share", () => {
	const rows: Residual[] = Array.from({ length: 40 }, (_, i) => ({
		ward: `W${i}`,
		release: "r2",
		party: "con",
		atRisk: i / 40,
		error: (0.1 * i) / 40,
		years: 1,
		changed: true,
	}));
	const { spread, factor } = calibrate(rows);
	assert.ok(Math.abs(spread - 0.1) < 1e-9);
	assert.ok(Math.abs(factor - 0.196) < 1e-9);
});
