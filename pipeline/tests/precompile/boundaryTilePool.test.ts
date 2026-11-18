import assert from "node:assert/strict";
import { test } from "vitest";
import { runBoundaryTileJobs } from "../../src/precompile/boundaryTilePool.ts";

const fixture = new URL("./fixtures/tileWorker.mjs", import.meta.url);
const jobs = (labels: string[]) =>
	labels.map((label) => ({ label, asset: label }));

test("out-of-order worker results retain their job indexes", async () => {
	const order: number[] = [];
	const results: string[] = [];
	await runBoundaryTileJobs(
		jobs(["slow", "fast", "last"]),
		2,
		async (index, result) => {
			order.push(index);
			results[index] = Buffer.from(result.bytes).toString();
		},
		fixture,
	);
	assert.notEqual(order[0], 0);
	assert.deepEqual(results, ["slow", "fast", "last"]);
});

test.each(["fail", "crash"])(
	"worker %s rejects without publishing",
	async (failure) => {
		const staged = new Map<number, string>();
		const published: string[] = [];
		await assert.rejects(async () => {
			await runBoundaryTileJobs(
				jobs(["slow", failure]),
				2,
				async (index, result) => {
					staged.set(index, Buffer.from(result.bytes).toString());
				},
				fixture,
			);
			published.push(...staged.values());
		}, /Boundary tile/);
		assert.deepEqual(published, []);
	},
);
