import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";
import { createApiServer } from "../src/apiServer";
import type { RouteContext } from "../src/routing";
import type { LogEntry, ServerOptions } from "../src/serverOptions";
import {
	atlasRelease,
	compatibleWardAreaLookup,
	testContext,
} from "./routeFixtures";

const openapiDocument = readFileSync(
	new URL("../openapi.yaml", import.meta.url),
	"utf8",
);

const serve = async (
	t: TestContext,
	options: ServerOptions = {},
	context: RouteContext = testContext({
		atlasRelease,
		openapiDocument,
		areaLookup: compatibleWardAreaLookup,
	}),
) => {
	const logged: LogEntry[] = [];
	const server = createApiServer(context, {
		log: (entry) => logged.push(entry),
		...options,
	});
	await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
	t.after(() => {
		server.close();
	});
	const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	return {
		server,
		logged,
		get: (path: string, init?: RequestInit) =>
			fetch(`${base}${path}`, init),
	};
};

test("identifies every response by its release and a request id", async (t) => {
	const { get, logged } = await serve(t, { accessLog: true });
	const response = await get("/v1/geographies", {
		headers: { "x-request-id": "client-trace-42" },
	});
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("atlas-release"), atlasRelease.releaseId);
	assert.equal(response.headers.get("x-request-id"), "client-trace-42");

	// An id that could break a log line is replaced, not echoed.
	const generated = await get("/v1/geographies", {
		headers: { "x-request-id": "bad id\twith spaces" },
	});
	assert.match(generated.headers.get("x-request-id")!, /^[0-9a-f-]{36}$/);

	// A 404 is labelled as unmatched rather than by its path, so a scan of
	// made-up paths cannot grow the metrics.
	await get("/v1/areas/ward/2023-05-uk-bgc/E05000001");
	await get("/v1/no/such/thing");
	assert.deepEqual(
		logged.map(({ route, status, requestId }) => ({
			route,
			status,
			requestId:
				requestId === "client-trace-42" ? requestId : "generated",
		})),
		[
			{
				route: "/v1/geographies",
				status: 200,
				requestId: "client-trace-42",
			},
			{ route: "/v1/geographies", status: 200, requestId: "generated" },
			{
				route: "/v1/areas/{geography}/{release}/{code}",
				status: 200,
				requestId: "generated",
			},
			{ route: "unmatched", status: 404, requestId: "generated" },
		],
	);
	assert.ok(logged.every((entry) => typeof entry.durationMs === "number"));
});

test("answers a failing handler with a 500 that can be found in the logs", async (t) => {
	let broken = false;
	const context = testContext({ openapiDocument });
	const failing = Object.defineProperty({ ...context }, "atlasRelease", {
		get() {
			if (broken) throw new Error("artifact went missing");
			return atlasRelease;
		},
	});
	const reported: unknown[] = [];
	const { get, logged } = await serve(
		t,
		{ onError: (error) => reported.push(error) },
		failing,
	);
	broken = true;
	const response = await get("/v1/geographies");
	assert.equal(response.status, 500);
	assert.equal(
		response.headers.get("content-type"),
		"application/problem+json",
	);
	assert.equal(response.headers.get("cache-control"), "no-store");
	const body = (await response.json()) as {
		requestId: string;
		detail: string;
	};
	assert.equal(body.requestId, response.headers.get("x-request-id"));
	assert.doesNotMatch(body.detail, /artifact went missing/);

	assert.equal(logged.length, 1);
	const [entry] = logged;
	assert.equal(entry!.level, "error");
	assert.equal(entry!.event, "request.failed");
	assert.equal(entry!.requestId, body.requestId);
	assert.equal(entry!.route, "/v1/geographies");
	assert.match(
		(entry!.error as { stack: string }).stack,
		/artifact went missing/,
	);
	assert.equal(reported.length, 1);

	// The server is still serving afterwards.
	broken = false;
	assert.equal((await get("/v1/geographies")).status, 200);
});

test("limits each client and tells it when to come back", async (t) => {
	const { get, server } = await serve(t, {
		rateLimit: { capacity: 2, refillPerSecond: 0.01 },
	});
	const first = await get("/v1/geographies");
	assert.equal(first.headers.get("ratelimit-policy"), '"default";q=2;w=200');
	assert.equal(first.headers.get("ratelimit"), '"default";r=1;t=100');
	assert.equal((await get("/v1/geographies")).status, 200);

	const refused = await get("/v1/geographies");
	assert.equal(refused.status, 429);
	assert.equal(refused.headers.get("retry-after"), "100");
	assert.equal(refused.headers.get("cache-control"), "no-store");
	assert.equal(refused.headers.get("access-control-allow-origin"), "*");

	// A preflight and the operations endpoints are never refused: a refused
	// probe would take a healthy instance out of service.
	assert.equal(
		(await get("/v1/geographies", { method: "OPTIONS" })).status,
		204,
	);
	assert.equal((await get("/healthz")).status, 200);
	assert.equal((await get("/readyz")).status, 200);
	assert.equal(server.metrics.rateLimited.value(), 1);
});

test("keys clients behind a trusted proxy by the address the proxy saw", async (t) => {
	const { get } = await serve(t, {
		rateLimit: { capacity: 1, refillPerSecond: 0.01, trustedProxyHops: 1 },
	});
	const from = (forwarded: string) =>
		get("/v1/geographies", { headers: { "x-forwarded-for": forwarded } });
	assert.equal((await from("203.0.113.1")).status, 200);
	assert.equal((await from("203.0.113.2")).status, 200);
	// A client cannot escape its limit by writing its own entry first.
	assert.equal((await from("198.51.100.9, 203.0.113.1")).status, 429);
});

test("refuses an overlong request target before routing it", async (t) => {
	const { get } = await serve(t, { maxUrlLength: 300 });
	const response = await get(`/v1/areas?q=${"a".repeat(400)}`);
	assert.equal(response.status, 414);
	assert.equal(
		response.headers.get("content-type"),
		"application/problem+json",
	);
});

test("reports health, readiness and metrics outside the versioned API", async (t) => {
	const { get, server } = await serve(t, { metricsToken: "secret" });
	const health = await get("/healthz");
	assert.equal(health.status, 200);
	assert.equal(health.headers.get("cache-control"), "no-store");

	await get("/v1/geographies");
	await get("/v1/geographies", { method: "HEAD" });
	await get(`/v1/atlas-releases/${atlasRelease.releaseId}/geographies`);

	assert.equal((await get("/metrics")).status, 401);
	assert.equal(
		(await get("/metrics", { headers: { authorization: "Bearer wrong!" } }))
			.status,
		401,
	);
	const metrics = await get("/metrics", {
		headers: { authorization: "Bearer secret" },
	});
	assert.equal(metrics.status, 200);
	const text = await metrics.text();
	assert.match(
		text,
		/^atlas_api_requests_total\{route="\/v1\/geographies",method="GET",status="200"\} 1$/m,
	);
	assert.match(
		text,
		/^atlas_api_requests_total\{route="\/v1\/geographies",method="HEAD",status="200"\} 1$/m,
	);
	assert.match(
		text,
		/^atlas_api_requests_total\{route="\/v1\/atlas-releases\/\{release-id\}\/geographies",method="GET",status="200"\} 1$/m,
	);
	assert.match(
		text,
		/^atlas_api_request_duration_seconds_bucket\{route="\/v1\/geographies",le="\+Inf"\} 2$/m,
	);
	assert.match(
		text,
		new RegExp(
			`^atlas_api_release_info\\{release="${atlasRelease.releaseId}",api_version="v1"\\} 1$`,
			"m",
		),
	);
	assert.match(
		text,
		/^atlas_api_event_loop_delay_seconds\{quantile="0.99"\} /m,
	);

	// Draining: readiness fails first so traffic moves away, while requests
	// already arriving are still answered.
	const ready = await get("/readyz");
	assert.equal(ready.status, 200);
	assert.equal(
		((await ready.json()) as { atlasRelease: string }).atlasRelease,
		atlasRelease.releaseId,
	);
	server.beginDrain();
	// The idle connection is closed; give the client a moment to see it
	// rather than race it with the next request.
	await new Promise((settled) => setTimeout(settled, 50));
	const draining = await get("/readyz");
	assert.equal(draining.status, 503);
	assert.equal(
		((await draining.json()) as { status: string }).status,
		"draining",
	);
	const during = await get("/v1/geographies");
	assert.equal(during.status, 200);
	assert.equal(during.headers.get("connection"), "close");
});
