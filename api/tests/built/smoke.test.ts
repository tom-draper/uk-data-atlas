import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runSmoke } from "../../scripts/smoke";
import { createApiServer, readApiCatalogues } from "../../src/server";

/**
 * The deployment smoke suite, run against the compiled catalogues as
 * `pnpm start` serves them. A check that fails here would fail every
 * deployment, so the suite is held to passing in full before it gates one.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("passes the deployment smoke suite against a local server", async (t) => {
	const server = createApiServer(readApiCatalogues(apiRoot), {
		rateLimit: { capacity: 1000, refillPerSecond: 100 },
		metricsToken: "smoke",
	});
	await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
	t.after(() => {
		server.close();
	});
	const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

	const results = await runSmoke(base, { metricsToken: "smoke" });
	assert.deepEqual(
		results.filter((result) => result.outcome !== "pass"),
		[],
	);
	assert.ok(results.length >= 15);

	// Without the token the protected metrics are skipped, not failed, and
	// every other check still passes.
	const anonymous = await runSmoke(base);
	assert.deepEqual(
		anonymous
			.filter((result) => result.outcome !== "pass")
			.map(({ name, outcome }) => ({ name, outcome })),
		[{ name: "metrics", outcome: "skip" }],
	);
});

test("fails a deployment that is not serving the contract", async (t) => {
	const results = await runSmoke("http://127.0.0.1:9", {
		fetch: async () => new Response("down", { status: 502 }),
	});
	assert.ok(results.every((result) => result.outcome === "fail"));
	assert.match(results[0]!.detail, /answered 502/);
	t.diagnostic(`${results.length} checks failed as expected`);
});
