import assert from "node:assert/strict";
import test from "node:test";
import {
	changeRefusal,
	changeValue,
	computeChanges,
	periodSpan,
	periodsOverlap,
	relativeChangeRefusal,
} from "../src/change";
import type { Measure, PopulationObservation } from "../src/dataCatalog";

const measure = (valueKind: Measure["valueKind"]): Measure =>
	({ id: "test", valueKind, unit: "people" }) as unknown as Measure;

const record = (
	areaCode: string,
	value: number,
	confidenceInterval?: { lower: number; upper: number },
): PopulationObservation => ({
	areaCode,
	value,
	status: "observed",
	...(confidenceInterval ? { confidenceInterval } : {}),
});

test("reads single years and rolling windows as spans of years", () => {
	assert.deepEqual(periodSpan("2022"), { firstYear: 2022, lastYear: 2022 });
	assert.deepEqual(periodSpan("2001-2003"), {
		firstYear: 2001,
		lastYear: 2003,
	});
	assert.equal(periodSpan("year ending March 2023"), undefined);
});

test("knows when two periods share years", () => {
	// Neighbouring rolling windows hold two of their three years in common.
	assert.equal(periodsOverlap("2017-2019", "2018-2020"), true);
	assert.equal(periodsOverlap("2017-2019", "2019-2021"), true);
	// The first window after the last shared year does not.
	assert.equal(periodsOverlap("2017-2019", "2020-2022"), false);
	assert.equal(periodsOverlap("2011", "2022"), false);
	// Periods that cannot be placed in time are not assumed to overlap.
	assert.equal(periodsOverlap("2011", "unplaceable"), false);
});

test("refuses change for categories and positions, not quantities", () => {
	assert.ok(changeRefusal(measure("categorical")));
	assert.ok(changeRefusal(measure("ordinal")));
	for (const kind of ["count", "quantity", "ratio", "currency"] as const) {
		assert.equal(changeRefusal(measure(kind)), undefined, kind);
	}
});

test("offers relative change for everything but a ratio", () => {
	assert.ok(relativeChangeRefusal(measure("ratio")));
	for (const kind of ["count", "quantity", "currency"] as const) {
		assert.equal(relativeChangeRefusal(measure(kind)), undefined, kind);
	}
});

test("measures change as end minus start, absolutely and relatively", () => {
	const { changes } = computeChanges(
		measure("count"),
		[record("A", 100), record("B", 200)],
		[record("A", 150), record("B", 150)],
	);
	const byCode = new Map(changes.map((change) => [change.areaCode, change]));
	assert.equal(byCode.get("A")!.absoluteChange, 50);
	assert.equal(byCode.get("A")!.relativeChange, 0.5);
	assert.equal(byCode.get("B")!.absoluteChange, -50);
	assert.equal(byCode.get("B")!.relativeChange, -0.25);
});

test("gives no relative change from a zero start, or for a ratio", () => {
	const fromZero = computeChanges(
		measure("count"),
		[record("A", 0)],
		[record("A", 10)],
	).changes[0]!;
	assert.equal(fromZero.absoluteChange, 10);
	assert.equal(fromZero.relativeChange, null);
	assert.equal(changeValue(fromZero, "relative"), undefined);
	assert.equal(changeValue(fromZero, "absolute"), 10);

	const ratio = computeChanges(
		measure("ratio"),
		[record("A", 2)],
		[record("A", 3)],
	).changes[0]!;
	assert.equal(ratio.absoluteChange, 1);
	assert.equal(ratio.relativeChange, null);
});

test("sets aside areas present in only one period rather than pairing them", () => {
	const set = computeChanges(
		measure("count"),
		[record("A", 1), record("GONE", 1)],
		[record("A", 2), record("NEW", 1)],
	);
	assert.deepEqual(
		set.changes.map((change) => change.areaCode),
		["A"],
	);
	assert.deepEqual(set.onlyAtStart, ["GONE"]);
	assert.deepEqual(set.onlyAtEnd, ["NEW"]);
});

test("reports whether published intervals overlap, only where both exist", () => {
	const set = computeChanges(
		measure("quantity"),
		[
			record("CLEAR", 70, { lower: 69, upper: 71 }),
			record("NOISE", 70, { lower: 68, upper: 72 }),
			record("NONE", 70),
		],
		[
			record("CLEAR", 75, { lower: 74, upper: 76 }),
			record("NOISE", 71, { lower: 69, upper: 73 }),
			record("NONE", 71),
		],
	);
	const byCode = new Map(
		set.changes.map((change) => [change.areaCode, change]),
	);
	assert.equal(byCode.get("CLEAR")!.intervalsOverlap, false);
	assert.equal(byCode.get("NOISE")!.intervalsOverlap, true);
	// Without intervals there is nothing to say, so nothing is said.
	assert.equal("intervalsOverlap" in byCode.get("NONE")!, false);
});
