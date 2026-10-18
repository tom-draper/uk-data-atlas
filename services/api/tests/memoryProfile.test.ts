import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import {
	readMemoryScenarios,
	runMemoryWorkload,
} from "../scripts/memory-profile/workload";

const scenario = {
	name: "fixture",
	path: "/v1/data",
	requests: 7,
	concurrency: 3,
};

test("requires a bounded nonempty workload with unique names", () => {
	for (const input of [
		[],
		{},
		[scenario, scenario],
		[{ ...scenario, requests: 0 }],
		[{ ...scenario, concurrency: 0 }],
		[{ ...scenario, concurrency: 65 }],
		[{ ...scenario, path: "https://example.com" }],
		[{ ...scenario, body: "{}" }],
		[{ ...scenario, expectedStatuses: [] }],
	])
		assert.throws(() => readMemoryScenarios(input));
	assert.deepEqual(
		readMemoryScenarios([scenario])[0]?.expectedStatuses,
		[200],
	);
});

test("measures completed streamed responses at the requested concurrency", async (t) => {
	let active = 0;
	let peak = 0;
	const server = createServer((request, response) => {
		active += 1;
		peak = Math.max(peak, active);
		response.write("pay");
		setTimeout(() => {
			active -= 1;
			response.end("load");
		}, 10);
	});
	t.after(() => server.close());
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	const result = await runMemoryWorkload(
		`http://127.0.0.1:${address.port}`,
		readMemoryScenarios([scenario])[0]!,
	);
	assert.equal(peak, 3);
	assert.equal(result.requests, 7);
	assert.equal(result.responseBytes, 49);
	assert.deepEqual(result.statuses, { 200: 7 });
	assert.equal(result.passed, true);
	assert.ok(result.latencyMs.p50 > 0);
	assert.ok(result.latencyMs.p95 <= result.latencyMs.max);
});

test("reports unexpected HTTP responses as a failed scenario", async (t) => {
	const server = createServer((_, response) => {
		response.writeHead(503);
		response.end("busy");
	});
	t.after(() => server.close());
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	const result = await runMemoryWorkload(
		`http://127.0.0.1:${address.port}`,
		readMemoryScenarios([scenario])[0]!,
	);
	assert.equal(result.passed, false);
	assert.deepEqual(result.statuses, { 503: 7 });
	assert.equal(result.responseBytes, 28);
});

test("counts transport failures without dropping the scenario report", async (t) => {
	const server = createServer((request) => request.socket.destroy());
	t.after(() => server.close());
	await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	const result = await runMemoryWorkload(
		`http://127.0.0.1:${address.port}`,
		readMemoryScenarios([scenario])[0]!,
	);
	assert.equal(result.requests, 7);
	assert.equal(result.passed, false);
	assert.deepEqual(result.statuses, {});
	assert.equal(
		Object.values(result.transportErrors).reduce(
			(sum, count) => sum + count,
			0,
		),
		7,
	);
});
