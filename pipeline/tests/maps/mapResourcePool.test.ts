import assert from "node:assert/strict";
import { test } from "vitest";
import {
	mapResourceConcurrency,
	mapResourceMemoryBudget,
	runMapResourceJobs,
	type Job,
} from "../../src/maps/mapResourcePool.ts";

const fixture = new URL("./fixtures/resourceWorker.mjs", import.meta.url);
const jobs = (ids: string[]): Job[] =>
	ids.map((id) => ({
		root: "",
		release: {
			id,
			geography: "ward",
			title: id,
			source: { publisher: "", url: "", licence: { name: "" } },
		},
		names: [],
		artifact: "",
		path: "",
		large: false,
	}));
test("returns results in inventory order despite out-of-order completion", async () => {
	const results = await runMapResourceJobs(
		jobs(["slow", "fast"]),
		2,
		fixture,
	);
	assert.deepEqual(
		results.map(
			(result) =>
				"unavailable" in result && [
					result.unavailable.boundaryRelease,
					result.unavailable.reason,
				],
		),
		[
			["slow", "fixture reason"],
			["fast", "fixture reason"],
		],
	);
});
test.each(["fail", "crash"])("names the release on worker %s", async (id) => {
	await assert.rejects(
		runMapResourceJobs(jobs(["slow", id]), 2, fixture),
		new RegExp(`ward/${id} worker failed`),
	);
});

test("sizes workers for a 7.6 GiB host and respects memory reservations", () => {
	const gib = 1024 ** 3;
	assert.equal(mapResourceConcurrency(7.6 * gib, 12, 0), 2);
	assert.ok(Math.abs(mapResourceMemoryBudget(7.6 * gib, 0) - 5.6 * gib) < 1);
	assert.equal(mapResourceConcurrency(5.9 * gib, 12, 0), 1);
	assert.equal(mapResourceConcurrency(7.6 * gib, 12, 3), 3);
	assert.equal(mapResourceMemoryBudget(7.6 * gib, 3), Infinity);
});

test("memory admission prevents a large and small job overlapping", async () => {
	const pair = jobs(["slow", "fast"]);
	pair[0]!.large = true;
	const completed: number[] = [];
	await runMapResourceJobs(
		pair,
		2,
		fixture,
		(index) => completed.push(index),
		5.6 * 1024 ** 3,
	);
	assert.deepEqual(completed, [0, 1]);
	const smallCompleted: number[] = [];
	pair[0]!.large = false;
	await runMapResourceJobs(
		pair,
		2,
		fixture,
		(index) => smallCompleted.push(index),
		5.6 * 1024 ** 3,
	);
	assert.deepEqual(smallCompleted, [1, 0]);
});
