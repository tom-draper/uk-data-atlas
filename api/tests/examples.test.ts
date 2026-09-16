import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createClient } from "../examples/client";
import { run as correctMap } from "../examples/correct-map";
import { run as defensibleTrend } from "../examples/defensible-trend";
import { run as reliableSync } from "../examples/reliable-sync";
import { createApiServer, readApiCatalogues } from "../src/server";

/**
 * The three golden paths, run against a real server over HTTP. They use only
 * the published contract, so a change that breaks a documented workflow fails
 * here rather than in a customer's integration.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("walks the three golden paths against a running server", async (t) => {
	const server = createApiServer(readApiCatalogues(apiRoot));
	await new Promise<void>((ready) => {
		server.listen(0, "127.0.0.1", ready);
	});
	t.after(() => {
		server.close();
	});
	const { port } = server.address() as AddressInfo;
	const client = createClient(`http://127.0.0.1:${port}`);

	for (const [path, walk] of [
		["correct map", correctMap],
		["defensible trend", defensibleTrend],
		["reliable sync", reliableSync],
	] as const) {
		const steps = await walk(client);
		assert.ok(steps.length >= 5, `${path} took only ${steps.length} steps`);
		assert.deepEqual(
			steps.filter((step) => step.detail.trim().length === 0),
			[],
			`${path} has a step that says nothing`,
		);
	}
});
