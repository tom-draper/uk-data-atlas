import { createAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import {
	fixtureObservationDatabase,
	writeObservationFixture,
} from "./observationFixtures";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { connect, type AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";
import { compileExportManifest } from "../../../pipeline/src/exportManifest";
import { observationArtifactName } from "@uk-data-atlas/atlas-runtime/catalogue";
import { readParquet } from "./parquetFixtures";
import { sha256 } from "@uk-data-atlas/artifacts";
import {
	createApiServer,
	isFastifyStaticPath,
	MAX_BODY_BYTES,
	sendFile,
} from "../src/apiServer";
import { httpResponse } from "../src/httpResponse";
import { route } from "../src/routes";
import { AreaGeometryCache } from "@uk-data-atlas/atlas-runtime/geometry";
import { LocationProjectionStore } from "@uk-data-atlas/atlas-runtime/places";
import { createOperationMatcher } from "@uk-data-atlas/atlas-runtime/api";
import type { RouteContext } from "@uk-data-atlas/atlas-runtime/api";
import { compileOperations } from "../../../pipeline/src/build-operations";
import type { LogEntry, ServerOptions } from "../src/serverOptions";
import type { StoredFile } from "@uk-data-atlas/artifacts";
import {
	atlasRelease,
	registry,
	dataCatalog,
	measureObservations,
	compatibleWardAreaLookup,
	testContext,
} from "./routeFixtures";

const openapiDocument = readFileSync(
	new URL("../openapi.yaml", import.meta.url),
	"utf8",
);
const operationMatcher = createOperationMatcher(
	compileOperations(openapiDocument).operations,
);

const serve = async (
	t: TestContext,
	options: ServerOptions = {},
	context: RouteContext = testContext({
		atlasRelease,
		openapiDocument,
		operationMatcher,
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
	const response = await get("/v1/boundaries", {
		headers: { "x-request-id": "client-trace-42" },
	});
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("atlas-release"), atlasRelease.releaseId);
	assert.equal(response.headers.get("x-request-id"), "client-trace-42");

	// An id that could break a log line is replaced, not echoed.
	const generated = await get("/v1/boundaries", {
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
				route: "/v1/boundaries",
				status: 200,
				requestId: "client-trace-42",
			},
			{ route: "/v1/boundaries", status: 200, requestId: "generated" },
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

test("refuses an undeclared query parameter and suggests the declared spelling", async (t) => {
	const { get } = await serve(t);
	const typo = await get("/v1/areas?geogaphy=ward");
	assert.equal(typo.status, 400);
	assert.deepEqual(await typo.json(), {
		type: "https://api.ukdataatlas.com/problems/unknown-query-parameter",
		title: "Unknown Query Parameter",
		status: 400,
		detail: "This operation does not accept the query parameter geogaphy.",
		code: "unknown_query_parameter",
		parameter: "geogaphy",
		suggestion: "geography",
	});
	assert.equal((await get("/v1/areas?geography=ward")).status, 200);
});

test("answers a failing handler with a 500 that can be found in the logs", async (t) => {
	let broken = false;
	const context = testContext({ openapiDocument, operationMatcher });
	const failing = Object.defineProperty({ ...context }, "atlasRelease", {
		get() {
			if (broken) throw new Error("artifact went missing");
			return atlasRelease;
		},
	});
	const reported: unknown[] = [];
	const { get, logged } = await serve(
		t,
		{ maxConcurrentRequests: 1, onError: (error) => reported.push(error) },
		failing,
	);
	broken = true;
	const response = await get("/v1/boundaries");
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
	assert.equal(entry!.route, "/v1/boundaries");
	assert.match(
		(entry!.error as { stack: string }).stack,
		/artifact went missing/,
	);
	assert.equal(reported.length, 1);

	// The server is still serving afterwards.
	broken = false;
	assert.equal((await get("/v1/boundaries")).status, 200);
});

test("contains a failure while finalising an otherwise successful response", async (t) => {
	let failAccessLog = true;
	const reported: unknown[] = [];
	const { get, logged } = await serve(t, {
		accessLog: true,
		log: (entry) => {
			if (failAccessLog && entry.event === "request")
				throw new Error("log sink unavailable");
			logged.push(entry);
		},
		onError: (error) => reported.push(error),
	});
	assert.equal((await get("/v1/boundaries")).status, 200);
	assert.equal(reported.length, 1);
	assert.match((reported[0] as Error).message, /log sink unavailable/);
	assert.ok(
		logged.some((entry) => entry.event === "request.failed"),
		"the finalisation failure is recorded",
	);

	// A best-effort logging failure does not poison the server's request loop.
	failAccessLog = false;
	assert.equal((await get("/v1/boundaries")).status, 200);
});

test("keeps client allowances and response headers local to each server", async (t) => {
	const options = { rateLimit: { capacity: 1, refillPerSecond: 0.001 } };
	const first = await serve(t, options);
	const second = await serve(t, options);
	const accepted = await first.get("/v1/boundaries");
	assert.equal(accepted.status, 200);
	assert.equal(accepted.headers.get("ratelimit"), '"default";r=0;t=1000');
	const refused = await first.get("/v1/boundaries");
	assert.equal(refused.status, 429);
	assert.equal(refused.headers.get("retry-after"), "1000");
	assert.match((await refused.json()).detail, /this worker/);
	const independent = await second.get("/v1/boundaries");
	assert.equal(independent.status, 200);
	assert.equal(independent.headers.get("ratelimit"), '"default";r=0;t=1000');
	assert.equal((await second.get("/v1/boundaries")).status, 429);
	assert.equal(first.server.metrics.rateLimited.value(), 1);
	assert.equal(second.server.metrics.rateLimited.value(), 1);
});

test("limits each client and tells it when to come back", async (t) => {
	const { get, server } = await serve(t, {
		rateLimit: { capacity: 2, refillPerSecond: 0.01 },
	});
	const first = await get("/v1/boundaries");
	assert.equal(first.headers.get("ratelimit-policy"), '"default";q=2;w=200');
	assert.equal(first.headers.get("ratelimit"), '"default";r=1;t=100');
	assert.equal((await get("/v1/boundaries")).status, 200);

	const refused = await get("/v1/boundaries");
	assert.equal(refused.status, 429);
	assert.equal(refused.headers.get("retry-after"), "100");
	assert.equal(refused.headers.get("cache-control"), "no-store");
	assert.equal(refused.headers.get("access-control-allow-origin"), "*");

	// A preflight and the operations endpoints are never refused: a refused
	// probe would take a healthy instance out of service.
	assert.equal(
		(await get("/v1/boundaries", { method: "OPTIONS" })).status,
		204,
	);
	assert.equal((await get("/healthz")).status, 200);
	assert.equal((await get("/readyz")).status, 200);
	assert.equal(server.metrics.rateLimited.value(), 1);
});

test("charges an operation that reads many shapes what it declares", async (t) => {
	const { get } = await serve(t, {
		rateLimit: { capacity: 12, refillPerSecond: 0.01 },
	});
	// areas:intersects declares a cost of 10 in the contract.
	const costly = await get(
		"/v1/areas:intersects?geography=ward&release=2023-05-uk-bgc&bbox=-1,53,0,54",
	);
	assert.equal(costly.headers.get("ratelimit"), '"default";r=2;t=1000');
	assert.equal((await get("/v1/boundaries")).status, 200);
	assert.equal((await get("/v1/boundaries")).status, 200);
	assert.equal((await get("/v1/boundaries")).status, 429);
});

test("charges point lookups once for every requested geography", async (t) => {
	const { get } = await serve(t, {
		rateLimit: { capacity: 6, refillPerSecond: 0.01 },
	});
	const response = await get(
		"/v1/areas:contains?lng=-2&lat=53&geography=ward&geography=localAuthority",
	);
	assert.equal(response.headers.get("ratelimit"), '"default";r=4;t=200');
	const defaulted = await get("/v1/areas:contains?lng=-2&lat=53");
	assert.equal(defaulted.headers.get("ratelimit"), '"default";r=1;t=500');
});

test("keys clients behind a trusted proxy by the address the proxy saw", async (t) => {
	const { get } = await serve(t, {
		rateLimit: { capacity: 1, refillPerSecond: 0.01, trustedProxyHops: 1 },
	});
	const from = (forwarded: string) =>
		get("/v1/boundaries", { headers: { "x-forwarded-for": forwarded } });
	assert.equal((await from("203.0.113.1")).status, 200);
	assert.equal((await from("203.0.113.2")).status, 200);
	// A client cannot escape its limit by writing its own entry first.
	assert.equal((await from("198.51.100.9, 203.0.113.1")).status, 429);
});

test("refuses an overlong request target before routing it", async (t) => {
	const { get } = await serve(t, { maxUrlLength: 300 });
	const response = await get(`/v1/places?q=${"a".repeat(400)}`);
	assert.equal(response.status, 414);
	assert.equal(
		response.headers.get("content-type"),
		"application/problem+json",
	);
});

test("reports health, readiness and metrics outside the versioned API", async (t) => {
	const { get, server } = await serve(t, { metrics: { token: "secret" } });
	const health = await get("/healthz");
	assert.equal(health.status, 200);
	assert.equal(health.headers.get("cache-control"), "no-store");

	await get("/v1/boundaries");
	await get("/v1/boundaries", { method: "HEAD" });

	assert.equal((await get("/metrics")).status, 401);
	// Without a token or an explicit opening, metrics are not there at all.
	const closed = await serve(t);
	assert.equal((await closed.get("/metrics")).status, 404);
	const open = await serve(t, { metrics: "open" });
	assert.equal((await open.get("/metrics")).status, 200);
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
		/^atlas_api_requests_total\{route="\/v1\/boundaries",method="GET",status="200"\} 1$/m,
	);
	assert.match(
		text,
		/^atlas_api_requests_total\{route="\/v1\/boundaries",method="HEAD",status="200"\} 1$/m,
	);
	assert.match(
		text,
		/^atlas_api_request_duration_seconds_bucket\{route="\/v1\/boundaries",le="\+Inf"\} 2$/m,
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
	const during = await get("/v1/boundaries");
	assert.equal(during.status, 200);
	assert.equal(during.headers.get("connection"), "close");
});

test("treats a client that drops mid-body as a closed request, not a server failure", async (t) => {
	const failed: unknown[] = [];
	const { server, logged } = await serve(t, {
		accessLog: true,
		onError: (error) => failed.push(error),
	});
	const socket = connect((server.address() as AddressInfo).port, "127.0.0.1");
	await new Promise<void>((ready) => socket.once("connect", ready));
	// Promises a 5000-byte body, sends 11 bytes of it, then goes away.
	socket.write(
		"POST /v1/areas:validate?geography=ward&release=2023-05-uk-bgc HTTP/1.1\r\n" +
			"host: localhost\r\ncontent-type: application/json\r\n" +
			'content-length: 5000\r\n\r\n{"values":[',
	);
	await new Promise((resolve) => setTimeout(resolve, 50));
	socket.destroy();
	for (let waited = 0; logged.length === 0 && waited < 2000; waited += 20)
		await new Promise((resolve) => setTimeout(resolve, 20));

	assert.deepEqual(
		logged.map(({ level, event, status }) => ({ level, event, status })),
		[{ level: "info", event: "request", status: 499 }],
	);
	assert.deepEqual(failed, []);
});

test("reads a POST body, refuses one too large, and never caches the answer", async (t) => {
	const { get } = await serve(t);
	const validate = "/v1/areas:validate?geography=ward&release=2023-05-uk-bgc";
	const posted = await get(validate, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ values: ["E05000001"] }),
	});
	assert.equal(posted.status, 200);
	// An answer that depends on a body no cache keys on is not stored.
	assert.equal(posted.headers.get("cache-control"), "no-store");
	assert.equal(posted.headers.get("etag"), null);

	const tooLarge = await get(validate, {
		method: "POST",
		headers: { "content-type": "text/csv" },
		body: `area\n${"E05000001\n".repeat(MAX_BODY_BYTES / 10 + 1)}`,
	});
	assert.equal(tooLarge.status, 413);

	// A browser may send the body cross-origin once its preflight allows it.
	const preflight = await get(validate, { method: "OPTIONS" });
	assert.match(
		preflight.headers.get("access-control-allow-methods")!,
		/POST/,
	);
	assert.match(
		preflight.headers.get("access-control-allow-headers")!,
		/content-type/,
	);
});

test(
	"closes a stored file when its client goes away mid-download",
	{ timeout: 10_000 },
	async (t) => {
		const directory = mkdtempSync(join(tmpdir(), "atlas-send-file-"));
		t.after(() => rmSync(directory, { recursive: true, force: true }));
		const path = join(directory, "large.bin");
		// Far more than a socket buffers, so the stream is still reading when the
		// client leaves.
		const bytes = 64 * 1024 * 1024;
		writeFileSync(path, Buffer.alloc(bytes));
		let source: ReturnType<typeof sendFile> | undefined;
		const server = createServer((_, response) => {
			response.writeHead(200, { "content-length": String(bytes) });
			source = sendFile({ path, bytes, gunzip: false }, response);
		});
		await new Promise<void>((ready) =>
			server.listen(0, "127.0.0.1", ready),
		);
		t.after(() => server.close());
		const { port } = server.address() as AddressInfo;

		await new Promise<void>((received) => {
			const request = httpRequest(
				{ port, host: "127.0.0.1" },
				(response) =>
					response.once("data", () => {
						request.destroy();
						received();
					}),
			);
			request.on("error", () => {});
			request.end();
		});
		await new Promise<void>((closed) =>
			source!.closed ? closed() : source!.once("close", () => closed()),
		);
		assert.ok(source!.destroyed);
		assert.ok(source!.bytesRead < bytes);
	},
);

test("gzips a large JSON answer for a client that takes it, and revalidates it", async (t) => {
	const { get } = await serve(t);
	const plain = await get("/v1/openapi.yaml", {
		headers: { "accept-encoding": "identity" },
	});
	const text = await plain.text();
	assert.ok(text.length > 1024);
	assert.equal(plain.headers.get("content-encoding"), null);
	assert.equal(
		plain.headers.get("content-length"),
		String(Buffer.byteLength(text)),
	);
	assert.equal(plain.headers.get("vary"), "accept-encoding");

	const gzipped = await get("/v1/openapi.yaml", {
		headers: { "accept-encoding": "gzip" },
	});
	assert.equal(gzipped.headers.get("content-encoding"), "gzip");
	assert.equal(gzipped.headers.get("vary"), "accept-encoding");
	const encodedLength = Number(gzipped.headers.get("content-length"));
	assert.ok(encodedLength > 0 && encodedLength < text.length / 2);
	// fetch decodes it, so the text is the plain answer again.
	assert.equal(await gzipped.text(), text);
	// The encoded form is different bytes, so it has its own validator,
	// and that validator is the one that revalidates it.
	const etag = gzipped.headers.get("etag")!;
	assert.match(etag, /-gzip"$/);
	assert.notEqual(etag, plain.headers.get("etag"));
	const revalidated = await get("/v1/openapi.yaml", {
		headers: { "accept-encoding": "gzip", "if-none-match": etag },
	});
	assert.equal(revalidated.status, 304);

	// A small answer is not worth the gzip header.
	const small = await get("/v1/no/such/thing", {
		headers: { "accept-encoding": "gzip" },
	});
	assert.equal(small.headers.get("content-encoding"), null);
});

test("answers a repeat request from the response cache without running its handler", async (t) => {
	let handled = 0;
	const context = testContext({
		atlasRelease,
		openapiDocument,
		operationMatcher,
	});
	const counting = Object.defineProperty({ ...context }, "atlasRelease", {
		get() {
			handled += 1;
			return atlasRelease;
		},
	});
	const { get } = await serve(
		t,
		{ responseCacheBytes: 1024 * 1024, metrics: "open" },
		counting,
	);
	const afterStart = handled;
	const first = await get("/v1/boundaries");
	const body = await first.text();
	assert.equal(handled, afterStart + 1);

	const second = await get("/v1/boundaries");
	assert.equal(await second.text(), body);
	assert.equal(handled, afterStart + 1, "the handler did not run again");
	assert.equal(second.status, 200);
	assert.equal(second.headers.get("etag"), first.headers.get("etag"));
	assert.equal(
		second.headers.get("content-length"),
		first.headers.get("content-length"),
	);
	assert.equal(
		second.headers.get("cache-control"),
		first.headers.get("cache-control"),
	);
	// What belongs to the request is still the request's own.
	assert.notEqual(
		second.headers.get("x-request-id"),
		first.headers.get("x-request-id"),
	);
	assert.equal(second.headers.get("atlas-release"), atlasRelease.releaseId);

	// A client that holds it is told so, again without the handler.
	const revalidated = await get("/v1/boundaries", {
		headers: { "if-none-match": first.headers.get("etag")! },
	});
	assert.equal(revalidated.status, 304);
	assert.equal(revalidated.headers.get("etag"), first.headers.get("etag"));
	assert.equal(handled, afterStart + 1);

	// An answer to a different request is its own.
	await get("/v1");
	assert.equal(handled, afterStart + 2);

	// A refusal is never kept: the next request may well succeed.
	assert.equal((await get("/v1/no/such/thing")).status, 404);
	assert.equal((await get("/v1/no/such/thing")).status, 404);
	assert.equal(handled, afterStart + 4);

	const metrics = await (await get("/metrics")).text();
	assert.match(
		metrics,
		/atlas_api_response_cache_events_total\{event="hit"\} 2/,
	);
});

test("keeps the plain and the gzipped form of an answer apart", async (t) => {
	const { get } = await serve(t, { responseCacheBytes: 4 * 1024 * 1024 });
	const text = async (encoding: string) => {
		const response = await get("/v1/openapi.yaml", {
			headers: { "accept-encoding": encoding },
		});
		return {
			encoding: response.headers.get("content-encoding"),
			etag: response.headers.get("etag")!,
			length: response.headers.get("content-length")!,
			text: await response.text(),
		};
	};
	const plain = await text("identity");
	const gzipped = await text("gzip");
	assert.equal(plain.encoding, null);
	assert.equal(gzipped.encoding, "gzip");
	assert.notEqual(plain.etag, gzipped.etag);
	assert.equal(gzipped.text, plain.text);
	// Asked again, each is still its own form.
	assert.deepEqual(await text("identity"), plain);
	assert.deepEqual(await text("gzip"), gzipped);
	const revalidated = await get("/v1/openapi.yaml", {
		headers: { "accept-encoding": "gzip", "if-none-match": gzipped.etag },
	});
	assert.equal(revalidated.status, 304);
	assert.equal(revalidated.headers.get("vary"), "accept-encoding");
});

test("honours an explicit gzip refusal before and after caching", async (t) => {
	const { get } = await serve(t, { responseCacheBytes: 4 * 1024 * 1024 });
	const gzip = await get("/v1/openapi.yaml", {
		headers: { "accept-encoding": "gzip" },
	});
	assert.equal(gzip.headers.get("content-encoding"), "gzip");
	const text = await gzip.text();
	const gzipTag = gzip.headers.get("etag")!;
	for (const encoding of ["gzip;q=0, *", "*, gzip;q=0"]) {
		const response = await get("/v1/openapi.yaml", {
			headers: { "accept-encoding": encoding, "if-none-match": gzipTag },
		});
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("content-encoding"), null);
		assert.notEqual(response.headers.get("etag"), gzipTag);
		assert.equal(await response.text(), text);
	}
});

test("still limits a client whose requests are answered from the response cache", async (t) => {
	const { get } = await serve(t, {
		responseCacheBytes: 1024 * 1024,
		rateLimit: { capacity: 2, refillPerSecond: 0.001 },
	});
	assert.equal((await get("/v1/boundaries")).status, 200);
	assert.equal((await get("/v1/boundaries")).status, 200);
	assert.equal((await get("/v1/boundaries")).status, 429);
});

test("bounds active body reads without queuing and keeps probes available", async (t) => {
	const { get, server } = await serve(t, {
		maxConcurrentRequests: 1,
		maxQueuedRequests: 0,
		metrics: "open",
	});
	const address = server.address() as AddressInfo;
	const accepted = new Promise<void>((resolve) =>
		server.once("request", () => resolve()),
	);
	const held = httpRequest({
		host: "127.0.0.1",
		port: address.port,
		path: "/v1/areas:lookup",
		method: "POST",
		headers: { "content-type": "application/json" },
	});
	held.on("error", () => {});
	t.after(() => held.destroy());
	held.flushHeaders();
	await accepted;
	const refused = await get("/v1/boundaries", {
		headers: { "accept-encoding": "gzip" },
	});
	assert.equal(refused.status, 503);
	assert.equal(refused.headers.get("retry-after"), "1");
	assert.equal(refused.headers.get("cache-control"), "no-store");
	assert.equal(refused.headers.get("access-control-allow-origin"), "*");
	assert.equal(refused.headers.get("content-encoding"), null);
	assert.equal((await refused.json()).title, "Server Busy");
	const refusedContract = await get("/v1/atlas-release");
	assert.equal(refusedContract.status, 503);
	assert.equal((await refusedContract.json()).title, "Server Busy");
	for (const path of ["/healthz", "/readyz", "/metrics"])
		assert.equal((await get(path)).status, 200);
	assert.equal(
		(await get("/v1/boundaries", { method: "OPTIONS" })).status,
		204,
	);
	// Complete the admitted body rather than waiting for its timeout.
	const completed = new Promise<void>((resolve) =>
		held.once("response", (response) => {
			response.resume();
			response.once("end", resolve);
		}),
	);
	held.end("{}");
	await completed;
	assert.equal((await get("/v1/boundaries")).status, 200);
});

test("releases admission after a client abandons an unfinished body", async (t) => {
	const { get, server } = await serve(t, {
		maxConcurrentRequests: 1,
		maxQueuedRequests: 0,
	});
	const address = server.address() as AddressInfo;
	let connection: import("node:net").Socket | undefined;
	server.once("connection", (socket) => {
		connection = socket;
	});
	const accepted = new Promise<void>((resolve) =>
		server.once("request", () => resolve()),
	);
	const held = httpRequest({
		host: "127.0.0.1",
		port: address.port,
		path: "/v1/areas:lookup",
		method: "POST",
	});
	held.on("error", () => {});
	t.after(() => held.destroy());
	held.flushHeaders();
	await accepted;
	assert.equal((await get("/v1/boundaries")).status, 503);
	const closed = new Promise<void>((resolve) =>
		connection!.once("close", () => resolve()),
	);
	held.destroy();
	await closed;
	await new Promise<void>((resolve) => setImmediate(resolve));
	assert.equal((await get("/v1/boundaries")).status, 200);
});

test(
	"holds admission while a large response waits for its reader",
	{ timeout: 10_000 },
	async (t) => {
		const context = testContext({
			openapiDocument: "x".repeat(16 * 1024 * 1024),
			operationMatcher,
		});
		const { get, server } = await serve(
			t,
			{ maxConcurrentRequests: 1, maxQueuedRequests: 0 },
			context,
		);
		const address = server.address() as AddressInfo;
		let connection: import("node:net").Socket | undefined;
		server.once("connection", (socket) => {
			connection = socket;
		});
		const download = httpRequest({
			host: "127.0.0.1",
			port: address.port,
			path: "/v1/openapi.yaml",
			headers: { "accept-encoding": "identity" },
		});
		download.on("error", () => {});
		t.after(() => download.destroy());
		await new Promise<void>((resolve) =>
			download
				.once("response", (response) => {
					response.pause();
					resolve();
				})
				.end(),
		);
		assert.equal((await get("/v1/boundaries")).status, 503);
		const closed = new Promise<void>((resolve) =>
			connection!.once("close", () => resolve()),
		);
		download.destroy();
		await closed;
		await new Promise<void>((resolve) => setImmediate(resolve));
		assert.equal((await get("/v1/boundaries")).status, 200);
	},
);

// Takes the only active slot with a POST whose body is still being sent.
const holdSlot = async (
	t: TestContext,
	server: ReturnType<typeof createApiServer>,
) => {
	const address = server.address() as AddressInfo;
	const accepted = new Promise<void>((resolve) =>
		server.once("request", () => resolve()),
	);
	const held = httpRequest({
		host: "127.0.0.1",
		port: address.port,
		path: "/v1/areas:lookup",
		method: "POST",
		headers: { "content-type": "application/json" },
	});
	held.on("error", () => {});
	t.after(() => held.destroy());
	held.flushHeaders();
	await accepted;
	return () =>
		new Promise<void>((resolve) => {
			held.once("response", (response) => {
				response.resume();
				response.once("end", resolve);
			});
			held.end("{}");
		});
};

test("queues a request until an active slot frees", async (t) => {
	const { get, server } = await serve(t, {
		maxConcurrentRequests: 1,
		queueTimeoutMs: 10_000,
	});
	const release = await holdSlot(t, server);
	let answered = false;
	const queued = get("/v1/boundaries").then((response) => {
		answered = true;
		return response;
	});
	await new Promise((resolve) => setTimeout(resolve, 50));
	assert.equal(answered, false);
	await release();
	assert.equal((await queued).status, 200);
});

test("refuses a queued request once its wait times out", async (t) => {
	const { get, server } = await serve(t, {
		maxConcurrentRequests: 1,
		queueTimeoutMs: 50,
	});
	const release = await holdSlot(t, server);
	const startedAt = performance.now();
	const refused = await get("/v1/boundaries");
	assert.ok(performance.now() - startedAt >= 45);
	assert.equal(refused.status, 503);
	assert.equal(refused.headers.get("retry-after"), "1");
	assert.equal((await refused.json()).title, "Server Busy");
	await release();
	assert.equal((await get("/v1/boundaries")).status, 200);
});

test("refuses at once when the queue is full", async (t) => {
	const { get, server } = await serve(t, {
		maxConcurrentRequests: 1,
		maxQueuedRequests: 1,
		queueTimeoutMs: 10_000,
	});
	const release = await holdSlot(t, server);
	const queued = get("/v1/boundaries");
	await new Promise((resolve) => setTimeout(resolve, 20));
	const startedAt = performance.now();
	assert.equal((await get("/v1/boundaries")).status, 503);
	assert.ok(performance.now() - startedAt < 1000);
	await release();
	assert.equal((await queued).status, 200);
});

test("gives up a queue place when its client disconnects", async (t) => {
	const { get, server } = await serve(t, {
		maxConcurrentRequests: 1,
		maxQueuedRequests: 1,
		queueTimeoutMs: 10_000,
	});
	const release = await holdSlot(t, server);
	const address = server.address() as AddressInfo;
	const socket = connect(address.port, "127.0.0.1");
	await new Promise<void>((resolve) => socket.once("connect", resolve));
	const arrived = new Promise<void>((resolve) =>
		server.once("request", () => resolve()),
	);
	socket.write("GET /v1/boundaries HTTP/1.1\r\nHost: x\r\n\r\n");
	await arrived;
	socket.destroy();
	await new Promise((resolve) => setTimeout(resolve, 20));
	const queued = get("/v1/boundaries");
	await new Promise((resolve) => setTimeout(resolve, 20));
	await release();
	assert.equal((await queued).status, 200);
});

test(
	"records completed, failed and cancelled stored export transfers",
	{ timeout: 10_000 },
	async (t) => {
		const directory = mkdtempSync(
			join(tmpdir(), "atlas-observation-downloads-"),
		);
		t.after(() => rmSync(directory, { recursive: true, force: true }));
		const measure = dataCatalog.measures.find(
			(item) => item.id === "small-area-fixture",
		)!;
		const source = measure.sources[0];
		const observations = measureObservations.find(
			(item) => item.measureId === measure.id,
		)!;
		writeObservationFixture(
			join(
				directory,
				`${observationArtifactName(measure.id, source)}.json`,
			),
			JSON.stringify(observations),
		);
		const catalog = {
			...dataCatalog,
			measures: [measure],
			datasets: [{ ...dataCatalog.datasets[0], id: source.datasetId }],
		};
		const manifest = compileExportManifest(
			directory,
			catalog,
			fixtureObservationDatabase(directory),
		);
		const files = manifest.exports[0].formats!;
		const exportFiles = new Map<string, StoredFile>(
			files.map((file) => [
				file.artifact,
				{
					path: join(directory, file.artifact),
					bytes: file.bytes,
					contentHash: file.contentHash,
					...(file.gzipBytes === undefined
						? {}
						: { gzipBytes: file.gzipBytes }),
				},
			]),
		);
		const { get, logged, server } = await serve(
			t,
			{ accessLog: true, maxConcurrentRequests: 1, maxQueuedRequests: 0 },
			testContext({
				atlasRelease,
				openapiDocument,
				operationMatcher,
				dataCatalog: catalog,
				exportManifest: manifest,
				exportFiles,
			}),
		);
		const waitForLog = async (count: number) => {
			const deadline = performance.now() + 2000;
			while (logged.length < count && performance.now() < deadline)
				await new Promise<void>((resolve) => setImmediate(resolve));
			assert.equal(logged.length, count);
		};
		for (const [index, file] of files.entries()) {
			const response = await get(file.href, {
				headers: { "accept-encoding": "identity" },
			});
			assert.equal(response.status, 200);
			const body = Buffer.from(await response.arrayBuffer());
			await waitForLog(index * 2 + 1);
			assert.equal(body.length, file.bytes);
			assert.equal(sha256(body), file.contentHash);
			assert.match(
				response.headers.get("content-disposition")!,
				new RegExp(`\\.${file.format}"$`),
			);
			const etag = response.headers.get("etag");
			assert.ok(etag);
			const cached = await get(file.href, {
				headers: {
					"accept-encoding": "identity",
					"if-none-match": etag,
				},
			});
			assert.equal(cached.status, 304);
			await waitForLog(index * 2 + 2);
			if (file.format === "parquet")
				assert.equal(readParquet(body).rowCount, 2);
			else
				assert.match(
					body.toString("utf8"),
					/"measureId","unit","datasetId"/,
				);
		}
		assert.equal(logged.length, 4);
		assert.equal(logged[0].status, 200);
		assert.equal(logged[0].bytes, files[0].bytes);
		assert.equal(logged[1].bytes, 0);
		// Parquet is stored as sent, so its bytes can be replaced in place below.
		const missing = files.find((file) => file.format === "parquet")!;
		rmSync(join(directory, missing.artifact));
		await assert.rejects(get(missing.href));
		for (let waited = 0; logged.length < 5 && waited < 2000; waited += 20)
			await new Promise((resolve) => setTimeout(resolve, 20));
		assert.equal(logged.length, 5);
		assert.equal(logged[4].event, "request.failed");
		assert.equal(logged[4].status, 500);
		assert.equal(logged[4].bytes, 0);
		const route = logged[4].route;
		assert.equal(typeof route, "string");
		assert.equal(
			server.metrics.failures.value({ route: String(route) }),
			1,
		);
		assert.equal((await get("/v1/boundaries")).status, 200);

		const file = exportFiles.get(missing.artifact)!;
		const bytes = 64 * 1024 * 1024;
		missing.bytes = bytes;
		file.bytes = bytes;
		writeFileSync(file.path, Buffer.alloc(bytes));
		const download = httpRequest({
			host: "127.0.0.1",
			port: (server.address() as AddressInfo).port,
			path: missing.href,
			headers: { "x-request-id": "interrupted-export" },
		});
		download.on("error", () => {});
		t.after(() => download.destroy());
		await new Promise<void>((resolve) => {
			download.once("response", (response) => {
				response.pause();
				resolve();
			});
			download.end();
		});
		await new Promise((resolve) => setTimeout(resolve, 50));
		assert.equal(
			logged.some((entry) => entry.requestId === "interrupted-export"),
			false,
		);
		assert.equal((await get("/v1/boundaries")).status, 503);
		download.destroy();
		for (
			let waited = 0;
			!logged.some((entry) => entry.requestId === "interrupted-export") &&
			waited < 2000;
			waited += 20
		)
			await new Promise((resolve) => setTimeout(resolve, 20));
		const cancelled = logged.filter(
			(entry) => entry.requestId === "interrupted-export",
		);
		assert.equal(cancelled.length, 1);
		assert.equal(cancelled[0].status, 499);
		assert.equal(cancelled[0].httpStatus, 200);
		assert.equal(cancelled[0].event, "request");
		assert.ok(
			Number(cancelled[0].bytes) > 0 &&
				Number(cancelled[0].bytes) < bytes,
		);
		assert.ok(Number(cancelled[0].durationMs) >= 50);
		assert.equal(
			server.metrics.requests.value({
				route: String(route),
				method: "GET",
				status: "499",
			}),
			1,
		);
		assert.equal(
			server.metrics.requests.value({
				route: String(route),
				method: "GET",
				status: "500",
			}),
			1,
		);
		assert.equal(
			server.metrics.failures.value({ route: String(route) }),
			1,
		);
		assert.equal((await get("/v1/boundaries")).status, 200);

		const content = Buffer.from(
			"a stored export with gzip and range support\n",
		);
		missing.bytes = content.length;
		file.bytes = content.length;
		writeFileSync(file.path, content);
		const range = await get(missing.href, {
			headers: { range: "bytes=2-7" },
		});
		assert.equal(range.status, 206);
		assert.equal(await range.text(), "stored");
		await waitForLog(10);
		assert.equal(logged.at(-1)!.bytes, 6);
		const encoded = gzipSync(content);
		writeFileSync(file.path, encoded);
		missing.gzipBytes = encoded.length;
		exportFiles.set(missing.artifact, {
			...file,
			gzipBytes: encoded.length,
		});
		for (const [index, encoding] of ["identity", "gzip"].entries()) {
			const response = await get(missing.href, {
				headers: { "accept-encoding": encoding },
			});
			assert.equal(response.status, 200);
			assert.equal(await response.text(), content.toString());
			await waitForLog(11 + index);
			assert.equal(
				logged.at(-1)!.bytes,
				encoding === "gzip" ? encoded.length : content.length,
			);
		}
	},
);

test("readiness and metrics read the startup caches", async (t) => {
	const cache = new AreaGeometryCache(tmpdir(), new Map(), 3);
	const projections = new LocationProjectionStore(
		{
			schemaVersion: 1,
			contentHash: "test",
			namedLocationInventoryHash: "test",
			crosswalkInventoryHash: "test",
			shards: [],
			parentShards: [],
		},
		() => {
			throw new Error("unexpected projection load");
		},
	);
	const context = testContext({
		areaGeometryCache: cache,
		locationProjectionStore: projections,
	});
	const { get } = await serve(t, { metrics: "open" }, context);
	const ready = (await (await get("/readyz")).json()) as {
		geometryCache: unknown;
	};
	assert.deepEqual(ready.geometryCache, cache.stats());
	const metrics = await (await get("/metrics")).text();
	assert.match(metrics, /atlas_api_geometry_cache/);
	assert.match(
		metrics,
		/^atlas_api_location_projection_cache_shards\{kind="limit"\} 8$/m,
	);
});

test("rejects an Atlas release response that violates its contract", async (t) => {
	const invalidArtifact = JSON.parse(
		'{"id":"sqlite","path":"data.sqlite","contentHash":12}',
	);
	const context = testContext({
		atlasRelease: { ...atlasRelease, artifacts: [invalidArtifact] },
		openapiDocument,
		operationMatcher,
	});
	const { get, logged } = await serve(t, {}, context);
	const response = await get("/v1/atlas-release");
	assert.equal(response.status, 500);
	assert.equal((await response.json()).title, "Internal Server Error");
	assert.equal(logged.at(-1)?.event, "request.failed");
});

test("production routes geography listings through Fastify", () => {
	assert.equal(isFastifyStaticPath("/v1/boundaries"), true);
	assert.equal(isFastifyStaticPath("/v1/boundary-releases"), true);
	assert.equal(isFastifyStaticPath("/v1/boundary-releases:resolve"), true);
	assert.equal(isFastifyStaticPath("/v1/boundary-releases:compare"), true);
});

test("production contract routes preserve dispatcher responses and HTTP controls", async (t) => {
	const context = testContext({
		atlasRelease,
		openapiDocument,
		operationMatcher,
	});
	const { get, logged } = await serve(
		t,
		{ accessLog: true, responseCacheBytes: 1024 * 1024 },
		context,
	);
	for (const path of [
		"/v1/atlas-release",
		"/v1/openapi.yaml",
		"/v1/docs",
		"/v1/boundaries",
		"/v1/boundary-releases",
	]) {
		const expected = httpResponse({ method: "GET", headers: {} }, () =>
			route("GET", path, context),
		);
		const response = await get(path, {
			headers: {
				"accept-encoding": "identity",
				"x-request-id": "contract-test",
			},
		});
		assert.equal(response.status, expected.status, path);
		assert.equal(await response.text(), expected.body, path);
		assert.equal(response.headers.get("etag"), expected.headers.etag, path);
		assert.equal(response.headers.get("x-request-id"), "contract-test");
		const head = await get(path, {
			method: "HEAD",
			headers: { "accept-encoding": "identity" },
		});
		assert.equal(head.status, 200, path);
		assert.equal(await head.text(), "", path);
		assert.equal(head.headers.get("etag"), expected.headers.etag, path);
		const conditional = await get(path, {
			headers: {
				"accept-encoding": "identity",
				"if-none-match": expected.headers.etag!,
			},
		});
		assert.equal(conditional.status, 304, path);
		const query = await get(`${path}?unexpected=1`);
		assert.equal(query.status, 400, path);
		assert.deepEqual(
			await query.json(),
			route("GET", `${path}?unexpected=1`, context).body,
			path,
		);
	}
	assert.ok(
		logged.some(
			(entry) =>
				entry.route === "/v1/atlas-release" && entry.status === 200,
		),
	);
});

test("Fastify contract routes use the server rate limiter", async (t) => {
	const { get, server } = await serve(t, {
		rateLimit: { capacity: 1, refillPerSecond: 0.01 },
	});
	assert.equal((await get("/v1/atlas-release")).status, 200);
	const refused = await get("/v1/atlas-release");
	assert.equal(refused.status, 429);
	assert.equal(refused.headers.get("retry-after"), "100");
	assert.equal(server.metrics.rateLimited.value(), 1);
});

test("Fastify catalogue listings match the dispatcher", async (t) => {
	const context = testContext({
		atlasRelease,
		dataCatalog,
		openapiDocument,
		operationMatcher,
		documents: new Map([
			["measure-population", { body: "{}", contentHash: "fixture" }],
		]),
	});
	const { get } = await serve(
		t,
		{ responseCacheBytes: 1024 * 1024 },
		context,
	);
	for (const path of [
		"/v1/datasets",
		"/v1/measures",
		"/v1/measures?q=population",
		"/v1/measures?q=missing",
		"/v1/measures?q=",
		"/v1/measures?unknown=1",
		"/v1/datasets?unknown=1",
	]) {
		const expected = httpResponse({ method: "GET", headers: {} }, () =>
			route("GET", path, context),
		);
		const response = await get(path, {
			headers: { "accept-encoding": "identity" },
		});
		assert.equal(response.status, expected.status, path);
		assert.equal(await response.text(), expected.body, path);
		assert.equal(
			response.headers.get("etag"),
			expected.headers.etag ?? null,
			path,
		);
		const head = await get(path, {
			method: "HEAD",
			headers: { "accept-encoding": "identity" },
		});
		assert.equal(head.status, expected.status, path);
		assert.equal(await head.text(), "", path);
	}
});

test("Fastify catalogue listings preserve an unavailable catalogue response", async (t) => {
	const context = testContext({
		atlasRelease,
		openapiDocument,
		operationMatcher,
	});
	const { get } = await serve(t, {}, context);
	for (const path of ["/v1/datasets", "/v1/measures?q=population"]) {
		const expected = route("GET", path, context);
		const response = await get(path);
		assert.equal(response.status, 503, path);
		assert.deepEqual(await response.json(), expected.body, path);
	}
});

test("Fastify catalogue listings reject a malformed successful response", async (t) => {
	const malformed = JSON.parse('{"id":"population","label":12}');
	const context = testContext({
		atlasRelease,
		openapiDocument,
		operationMatcher,
		dataCatalog: { ...dataCatalog, datasets: [malformed] },
	});
	const { get, logged } = await serve(t, {}, context);
	const response = await get("/v1/datasets");
	assert.equal(response.status, 500);
	assert.equal((await response.json()).title, "Internal Server Error");
	assert.equal(logged.at(-1)?.event, "request.failed");
});

test("Fastify catalogue listings preserve measure alias canonicalization without an operation matcher", async (t) => {
	const catalog = {
		...dataCatalog,
		measures: dataCatalog.measures.map((measure) =>
			measure.id === "population"
				? { ...measure, aliases: ["residents"] }
				: measure,
		),
	};
	const context = testContext({ atlasRelease, dataCatalog: catalog });
	context.operationMatcher = undefined;
	const { get } = await serve(t, {}, context);
	for (const path of [
		"/v1/datasets?measure=residents",
		"/v1/measures?q=population&measure=residents",
		"/v1/measures/residents?measure=residents",
	]) {
		const expected = route("GET", path, context);
		const response = await get(path);
		assert.equal(response.status, expected.status, path);
		const expectedHttp = httpResponse(
			{ method: "GET", headers: {} },
			() => expected,
		);
		assert.equal(await response.text(), expectedHttp.body, path);
		assert.equal(
			response.headers.get("content-location"),
			expected.headers?.["content-location"] ?? null,
			path,
		);
		assert.match(
			response.headers.get("content-location")!,
			/measure=population/,
		);
	}
});

test("Fastify catalogue detail routes preserve dispatcher behaviour", async (t) => {
	const catalog = {
		...dataCatalog,
		measures: dataCatalog.measures.map((measure) =>
			measure.id === "population"
				? { ...measure, aliases: ["residents"] }
				: measure,
		),
	};
	const context = testContext({
		atlasRelease,
		dataCatalog: catalog,
		openapiDocument,
		operationMatcher,
		documents: new Map([
			["measure-population", { body: "{}", contentHash: "fixture" }],
		]),
	});
	const { get } = await serve(
		t,
		{ responseCacheBytes: 1024 * 1024 },
		context,
	);
	for (const path of [
		"/v1/datasets/population",
		"/v1/measures/population",
		"/v1/measures/residents",
		"/v1/measures/%70opulation",
		"/v1/datasets/unknown",
		"/v1/measures/unknown",
		"/v1/measures/population?unknown=1",
		"/v1/measures/a%2Fb",
		`/v1/measures/${"x".repeat(150)}`,
	]) {
		const expected = httpResponse({ method: "GET", headers: {} }, () =>
			route("GET", path, context),
		);
		const response = await get(path, {
			headers: { "accept-encoding": "identity" },
		});
		assert.equal(response.status, expected.status, path);
		assert.equal(await response.text(), expected.body, path);
		assert.equal(
			response.headers.get("content-location"),
			expected.headers["content-location"] ?? null,
			path,
		);
		const head = await get(path, {
			method: "HEAD",
			headers: { "accept-encoding": "identity" },
		});
		assert.equal(head.status, expected.status, path);
		assert.equal(await head.text(), "", path);
	}
});

test("Fastify catalogue detail routes report an unavailable catalogue", async (t) => {
	const context = testContext({
		atlasRelease,
		openapiDocument,
		operationMatcher,
	});
	const { get } = await serve(t, {}, context);
	for (const path of [
		"/v1/datasets/population",
		"/v1/measures/population",
		`/v1/measures/${"%70".repeat(80)}`,
	]) {
		const response = await get(path);
		assert.equal(response.status, 503, path);
		assert.deepEqual(
			await response.json(),
			route("GET", path, context).body,
			path,
		);
	}
});

test("Fastify catalogue detail routes reject malformed successful responses", async (t) => {
	const malformed = JSON.parse('{"id":"population","label":12}');
	const context = testContext({
		atlasRelease,
		openapiDocument,
		operationMatcher,
		dataCatalog: { ...dataCatalog, datasets: [malformed] },
	});
	const { get, logged } = await serve(t, {}, context);
	const response = await get("/v1/datasets/population");
	assert.equal(response.status, 500);
	assert.equal((await response.json()).title, "Internal Server Error");
	assert.equal(logged.at(-1)?.event, "request.failed");
});

test("catalogue detail responses remain validated when a long id uses the dispatcher", async (t) => {
	const id = "x".repeat(150);
	const malformed = JSON.parse(JSON.stringify({ id, label: 12 }));
	const context = testContext({
		atlasRelease,
		openapiDocument,
		operationMatcher,
		dataCatalog: { ...dataCatalog, datasets: [malformed] },
	});
	const { get } = await serve(t, {}, context);
	const response = await get(`/v1/datasets/${id}`);
	assert.equal(response.status, 500);
	assert.equal((await response.json()).title, "Internal Server Error");
});

test("Fastify rejects a boundary release that violates its response contract", async (t) => {
	const context = testContext({
		atlasRelease,
		openapiDocument,
		operationMatcher,
	});
	const releases = context.geographyResolver.boundaryReleasesFor();
	assert.ok(releases.length > 0);
	context.geographyResolver = {
		...context.geographyResolver,
		boundaryReleasesFor: () => [{ ...releases[0]!, title: 123 } as never],
	};
	const { get, logged } = await serve(t, {}, context);
	const response = await get("/v1/boundary-releases");
	assert.equal(response.status, 500);
	assert.equal((await response.json()).title, "Internal Server Error");
	assert.equal(logged.at(-1)?.event, "request.failed");
});

test("Fastify boundary release detail preserves dispatcher behaviour", async (t) => {
	const context = testContext({
		atlasRelease,
		openapiDocument,
		operationMatcher,
	});
	const { get } = await serve(
		t,
		{ responseCacheBytes: 1024 * 1024 },
		context,
	);
	for (const path of [
		"/v1/boundary-releases/ward/2025-01-en-ward",
		"/v1/boundary-releases/ward/latest",
		"/v1/boundary-releases/%77ard/2025-01-en-ward",
		"/v1/boundary-releases/ward/missing",
		"/v1/boundary-releases/ward/2025-01-en-ward?unknown=1",
		"/v1/boundary-releases/ward/a%2Fb",
		`/v1/boundary-releases/ward/${"x".repeat(150)}`,
	]) {
		const expected = httpResponse({ method: "GET", headers: {} }, () =>
			route("GET", path, context),
		);
		const response = await get(path, {
			headers: { "accept-encoding": "identity" },
		});
		assert.equal(response.status, expected.status, path);
		assert.equal(await response.text(), expected.body, path);
		for (const header of [
			"content-location",
			"deprecation",
			"sunset",
			"link",
			"etag",
		]) {
			assert.equal(
				response.headers.get(header),
				expected.headers[header] ?? null,
				`${path} ${header}`,
			);
		}
		const head = await get(path, {
			method: "HEAD",
			headers: { "accept-encoding": "identity" },
		});
		assert.equal(head.status, expected.status, path);
		assert.equal(await head.text(), "", path);
	}
});

test("boundary release detail rejects malformed data on Fastify and fallback paths", async (t) => {
	const context = testContext({
		atlasRelease,
		openapiDocument,
		operationMatcher,
	});
	const release = context.geographyResolver.boundaryReleasesFor()[0]!;
	context.geographyResolver = {
		...context.geographyResolver,
		boundaryRelease: () => ({ ...release, title: 123 }) as never,
	};
	const { get } = await serve(t, {}, context);
	for (const id of [release.id, "x".repeat(150)]) {
		const response = await get(`/v1/boundary-releases/ward/${id}`);
		assert.equal(response.status, 500, id);
		assert.equal((await response.json()).title, "Internal Server Error");
	}
});

test("Fastify boundary release detail keeps deprecation headers", async (t) => {
	const boundaryRegistry = {
		...registry,
		releases: [
			{
				...registry.releases[0]!,
				deprecation: {
					deprecated: "2025-01-01",
					sunset: "2027-01-01",
					replacedBy: "2026-01-en-ward",
					reason: "Superseded",
				},
			},
		],
	};
	const context = testContext({
		atlasRelease,
		boundaryRegistry,
		openapiDocument,
		operationMatcher,
	});
	const path = "/v1/boundary-releases/ward/2025-01-en-ward";
	const expected = httpResponse({ method: "GET", headers: {} }, () =>
		route("GET", path, context),
	);
	const { get } = await serve(t, {}, context);
	const response = await get(path, {
		headers: { "accept-encoding": "identity" },
	});
	assert.equal(response.status, 200);
	for (const header of ["deprecation", "sunset", "link"]) {
		assert.ok(expected.headers[header], header);
		assert.equal(
			response.headers.get(header),
			expected.headers[header],
			header,
		);
	}
});

test("Fastify boundary selection and comparison preserve dispatcher responses", async (t) => {
	const boundaryRegistry = {
		...registry,
		releases: [
			{ ...registry.releases[0]!, id: "2024-05-en-ward" },
			{ ...registry.releases[0]!, id: "2025-05-en-ward" },
		],
	};
	const areaLookup = createAreaLookup(
		["2024-05-en-ward", "2025-05-en-ward"].map((boundaryRelease) => ({
			schemaVersion: 1,
			contentHash: `sha256:${boundaryRelease}`,
			geography: "ward",
			boundaryRelease,
			codeProperty: "code",
			nameProperty: "name",
			areas: [{ code: "E05000001", name: "Ward" }],
		})),
	);
	const context = testContext({
		atlasRelease,
		boundaryRegistry,
		areaLookup,
		openapiDocument,
		operationMatcher,
	});
	const { get } = await serve(t, {}, context);
	for (const path of [
		"/v1/boundary-releases:resolve?geography=ward&date=2025-05",
		"/v1/boundary-releases:resolve?geography=ward&date=2020-01",
		"/v1/boundary-releases:resolve?date=2025-05",
		"/v1/boundary-releases:resolve?geography=ward&date=2025-05&unknown=1",
		"/v1/boundary-releases:compare?geography=ward&from=2024-05-en-ward&to=2025-05-en-ward",
		"/v1/boundary-releases:compare?geography=ward&from=2024-05-en-ward&to=2024-05-en-ward",
	]) {
		const expected = httpResponse({ method: "GET", headers: {} }, () =>
			route("GET", path, context),
		);
		const response = await get(path, {
			headers: { "accept-encoding": "identity" },
		});
		assert.equal(response.status, expected.status, path);
		assert.equal(await response.text(), expected.body, path);
		const head = await get(path, { method: "HEAD" });
		assert.equal(head.status, expected.status, path);
		assert.equal(await head.text(), "", path);
	}
});
