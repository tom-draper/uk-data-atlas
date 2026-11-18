import assert from "node:assert/strict";
import { test } from "vitest";
import {
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
