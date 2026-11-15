import assert from "node:assert/strict";
import { test } from "vitest";
import {
	BETTER_ROUTE,
	chooseRoutes,
	type RouteCandidate,
} from "../../src/conversion/betterRoute.ts";
import type {
	ConvertedObservation,
	ConvertedSeries,
} from "../../src/conversion/convertSeries.ts";

/** A value on the target area `area` in `period`, regrouped whole. */
const value = (area: number, period: number, v = 1): ConvertedObservation => ({
	area,
	period,
	value: v,
	status: 6,
	lower: null,
	upper: null,
});

type Options = {
	key: string;
	geography?: string;
	release?: string;
	members?: string;
	exactShare?: number;
	coverage?: number;
	observations: ConvertedObservation[];
};

/** A series converted from `geography:release` onto the local authorities. */
const candidate = ({
	key,
	geography = "ward",
	release = "2024-05",
	members = "",
	exactShare = 1,
	coverage = 1,
	observations,
}: Options): RouteCandidate => ({
	series: {
		planId: key,
		key,
		datasetId: 1,
		measureId: 2,
		releaseId: 9,
		rule: "sum",
		basis: "population",
		inputs: [
			{
				role: "value",
				series: {
					id: 1,
					key: `x/y/${geography}:${release}`,
					dataset: "x",
					measure: "y",
					releaseId: 3,
					members,
				},
			},
		],
		crosswalks: [],
		note: null,
		periods: new Set(observations.map((o) => o.period)).size,
		quality: { exactShare, coverage },
		observations,
		gaps: [],
	} satisfies ConvertedSeries,
	sourceGeography: geography,
	sourceRelease: release,
	targetGeography: "localAuthority",
});

const kept = (choice: ReturnType<typeof chooseRoutes>) =>
	choice.kept.map((series) => series.key);

test("two sources that cover different periods both stay whole", () => {
	const old = candidate({
		key: "old",
		release: "2018-12",
		observations: [value(1, 2015), value(1, 2016)],
	});
	const recent = candidate({
		key: "recent",
		release: "2024-05",
		observations: [value(1, 2019), value(1, 2020)],
	});
	const choice = chooseRoutes([old, recent]);
	assert.deepEqual(kept(choice), ["old", "recent"]);
	assert.equal(choice.kept[0], old.series);
	assert.equal(choice.kept[1], recent.series);
	assert.deepEqual(choice.dropped, []);
	assert.equal(choice.clipped, 0);
});

test("where two sources hold the same area and period, one value is kept", () => {
	const a = candidate({
		key: "a",
		release: "2023-05",
		observations: [value(1, 2020, 10), value(2, 2020, 20)],
	});
	const b = candidate({
		key: "b",
		release: "2024-05",
		observations: [value(1, 2020, 11), value(2, 2020, 21)],
	});
	const choice = chooseRoutes([a, b]);
	// Equal quality, so the newer source release wins and the other is dropped.
	assert.deepEqual(kept(choice), ["b"]);
	assert.deepEqual(
		choice.dropped.map((series) => series.key),
		["a"],
	);
});

test("overlap is by area and period, so a source keeps what the better one lacks", () => {
	const better = candidate({
		key: "better",
		release: "2024-05",
		observations: [value(1, 2020), value(2, 2020)],
	});
	const wider = candidate({
		key: "wider",
		release: "2023-05",
		exactShare: 0.5,
		observations: [
			value(1, 2020, 5),
			value(2, 2020, 5),
			value(3, 2020, 5),
			value(1, 2019, 5),
		],
	});
	const choice = chooseRoutes([wider, better]);
	assert.deepEqual(kept(choice), ["wider", "better"]);
	const [clipped] = choice.kept;
	assert.deepEqual(
		clipped!.observations.map((o) => [o.area, o.period]),
		[
			[3, 2020],
			[1, 2019],
		],
	);
	// What it lost is recorded, and its quality counts what it now holds.
	assert.deepEqual(clipped!.gaps, [
		{ area: 1, period: 2020, reason: BETTER_ROUTE },
		{ area: 2, period: 2020, reason: BETTER_ROUTE },
	]);
	assert.equal(clipped!.quality.coverage, 0.5);
	assert.equal(choice.clipped, 2);
	// The better series is untouched.
	assert.equal(choice.kept[1], better.series);
});

test("sources rank by geography, exact share, coverage, release, then key", () => {
	const winner = (...rest: RouteCandidate[]) => {
		const choice = chooseRoutes(rest);
		assert.equal(choice.kept.length, 1);
		return choice.kept[0]!.key;
	};
	const cells = [value(1, 2020)];
	const base = { observations: cells };
	// A source on the target's geography beats a better exact share.
	assert.equal(
		winner(
			candidate({ ...base, key: "ward", exactShare: 1 }),
			candidate({
				...base,
				key: "authority",
				geography: "localAuthority",
				exactShare: 0.2,
				coverage: 0.1,
			}),
		),
		"authority",
	);
	assert.equal(
		winner(
			candidate({ ...base, key: "low", exactShare: 0.9 }),
			candidate({ ...base, key: "high", exactShare: 0.95 }),
		),
		"high",
	);
	assert.equal(
		winner(
			candidate({ ...base, key: "thin", coverage: 0.5 }),
			candidate({ ...base, key: "full", coverage: 0.9 }),
		),
		"full",
	);
	assert.equal(
		winner(
			candidate({ ...base, key: "older", release: "2022-05" }),
			candidate({ ...base, key: "newer", release: "2025-05" }),
		),
		"newer",
	);
	// The series key settles a tie, whatever the order the series arrive in.
	assert.equal(
		winner(
			candidate({ ...base, key: "b" }),
			candidate({ ...base, key: "a" }),
		),
		"a",
	);
	assert.equal(
		winner(
			candidate({ ...base, key: "a" }),
			candidate({ ...base, key: "b" }),
		),
		"a",
	);
});

test("series with different members do not compete", () => {
	const lab = candidate({
		key: "lab",
		members: "party=lab",
		observations: [value(1, 2020)],
	});
	const con = candidate({
		key: "con",
		members: "party=con",
		observations: [value(1, 2020)],
	});
	const choice = chooseRoutes([lab, con]);
	assert.deepEqual(kept(choice), ["lab", "con"]);
	assert.deepEqual(choice.dropped, []);
});

test("a series is chosen the same whichever order the sources arrive in", () => {
	const make = () => [
		candidate({
			key: "p",
			release: "2021-05",
			observations: [value(1, 1)],
		}),
		candidate({
			key: "q",
			release: "2022-05",
			observations: [value(1, 1)],
		}),
		candidate({
			key: "r",
			release: "2023-05",
			observations: [value(1, 1)],
		}),
	];
	const forward = make();
	const choice = chooseRoutes(forward);
	assert.deepEqual(kept(choice), ["r"]);
	assert.deepEqual(kept(chooseRoutes([...make()].reverse())), ["r"]);
});
