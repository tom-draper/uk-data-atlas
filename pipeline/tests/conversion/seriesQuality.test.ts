import assert from "node:assert/strict";
import { test } from "vitest";
import {
	convertThroughSteps,
	startValues,
} from "../../src/conversion/convert.ts";
import {
	qualityOf,
	type ConvertedObservation,
	type SeriesGap,
} from "../../src/conversion/convertSeries.ts";
import type { Step } from "../../src/conversion/crosswalkSteps.ts";

const value = (
	area: number,
	amount: number,
	estimated?: number,
): ConvertedObservation => ({
	area,
	period: 1,
	value: amount,
	status: estimated === undefined ? 6 : 2,
	lower: null,
	upper: null,
	...(estimated === undefined ? {} : { estimated }),
});

const gap = (area: number, reason: SeriesGap["reason"]): SeriesGap => ({
	area,
	period: 1,
	reason,
});

test("a series of regrouped values is wholly exact", () => {
	assert.deepEqual(qualityOf([value(1, 10), value(2, 30)], []), {
		exactShare: 1,
		coverage: 1,
	});
});

test("the exact share is the share of the value that took no split", () => {
	// 60 of 100 and 10 of 20 took a split: 70 of 120 is estimated.
	const quality = qualityOf([value(1, 100, 60), value(2, 20, 10)], []);
	assert.ok(Math.abs(quality.exactShare - 50 / 120) < 1e-12);
});

test("a value cannot be more estimated than it is large", () => {
	assert.equal(qualityOf([value(1, 10, 25)], []).exactShare, 0);
});

test("coverage counts target gaps and source areas no crosswalk carries", () => {
	const quality = qualityOf(
		[value(1, 5), value(2, 5), value(3, 5)],
		[gap(4, "unmeasured-split"), gap(900, "not-carried")],
	);
	assert.equal(quality.coverage, 0.6);
});

test("a series that drops source areas does not score as whole", () => {
	const quality = qualityOf(
		[value(1, 5), value(2, 5)],
		[gap(900, "not-carried"), gap(901, "not-carried")],
	);
	assert.equal(quality.coverage, 0.5);
});

test("a series with no values has no coverage and is not marked inexact", () => {
	assert.deepEqual(qualityOf([], [gap(4, "missing-input")]), {
		exactShare: 1,
		coverage: 0,
	});
	assert.equal(qualityOf([], []).coverage, 0);
});

test("the estimated mass of a carried value gives the exact share of the series", () => {
	const step: Step = {
		fromRelease: 1,
		toRelease: 2,
		crosswalks: [],
		reversed: false,
		edges: new Map([
			[1, [{ to: 10, weight: 1, risk: 0, pruned: 0, crosswalk: 7 }]],
			[
				2,
				[
					{
						to: 10,
						weight: 0.5,
						risk: 0.25,
						pruned: 0,
						crosswalk: 7,
					},
					{
						to: 11,
						weight: 0.5,
						risk: 0.25,
						pruned: 0,
						crosswalk: 7,
					},
				],
			],
		]),
		blocked: new Map(),
		feeders: new Map([
			[10, [1, 2]],
			[11, [2]],
		]),
	};
	const converted = convertThroughSteps(
		[step],
		startValues([
			[1, 60],
			[2, 40],
		]),
	);
	const observations = [...converted.values].map(([area, carried]) =>
		value(area, carried.value, carried.estimated),
	);
	// Area 10 is 60 whole and 20 split, area 11 is 20 split: 40 of 100.
	assert.equal(qualityOf(observations, []).exactShare, 0.6);
});

test("a negative value counts by its size and the share stays within 0 and 1", () => {
	const quality = qualityOf(
		[
			{ area: 1, period: 1, value: -100, estimated: 100 } as never,
			{ area: 2, period: 1, value: 300 } as never,
		],
		[],
	);
	assert.equal(quality.exactShare, 0.75);
});
