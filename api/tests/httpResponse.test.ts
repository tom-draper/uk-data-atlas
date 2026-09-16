import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	entityTag,
	httpResponse,
	matchesEntityTag,
	preflightResponse,
} from "../src/httpResponse";
import type { ApiResponse } from "../src/routeResponse";
import { route } from "../src/routes";
import { readApiCatalogues } from "../src/server";

const ok: ApiResponse = {
	status: 200,
	body: {
		apiVersion: "v1",
		atlasRelease: "sha256:release",
		data: { id: "example" },
		meta: { nextCursor: null },
	},
};
const body = `${JSON.stringify(ok.body)}\n`;

test("tags a successful response with the hash of its exact bytes", () => {
	const response = httpResponse({ method: "GET", headers: {} }, () => ok);
	assert.equal(response.status, 200);
	assert.equal(response.body, body);
	assert.equal(
		response.headers.etag,
		`"sha256-${createHash("sha256").update(body).digest("base64url")}"`,
	);
	assert.equal(
		response.headers["cache-control"],
		"public, max-age=300, must-revalidate",
	);
	assert.equal(response.headers["content-length"], String(body.length));
});

test("answers a matching conditional request with 304 and no body", () => {
	const etag = entityTag(body);
	for (const ifNoneMatch of [etag, `W/${etag}`, `"other", ${etag}`, "*"]) {
		const response = httpResponse(
			{ method: "GET", headers: { "if-none-match": ifNoneMatch } },
			() => ok,
		);
		assert.equal(response.status, 304, String(ifNoneMatch));
		assert.equal(response.body, undefined);
		assert.equal(response.headers.etag, etag);
	}
	assert.equal(
		httpResponse(
			{ method: "GET", headers: { "if-none-match": '"stale"' } },
			() => ok,
		).status,
		200,
	);
	assert.equal(matchesEntityTag(undefined, etag), false);
});

test("serves HEAD as GET without a body and never caches an error", () => {
	let routedMethod: string | undefined;
	const head = httpResponse({ method: "HEAD", headers: {} }, (method) => {
		routedMethod = method;
		return ok;
	});
	assert.equal(routedMethod, "GET");
	assert.equal(head.status, 200);
	assert.equal(head.body, undefined);
	assert.equal(head.headers["content-length"], String(body.length));
	assert.equal(head.headers.etag, entityTag(body));

	const unavailable = httpResponse({ method: "GET", headers: {} }, () => ({
		status: 503,
		body: {
			type: "https://api.ukdataatlas.com/problems/catalogue-unavailable",
			title: "Catalogue Unavailable",
			status: 503,
			detail: "Build it.",
		},
	}));
	assert.equal(unavailable.headers["cache-control"], "no-store");
	assert.equal(unavailable.headers.etag, undefined);
	assert.equal(
		unavailable.headers["content-type"],
		"application/problem+json",
	);
	// An error is not a representation a validator can match.
	assert.equal(
		httpResponse(
			{ method: "GET", headers: { "if-none-match": "*" } },
			() => ({ ...ok, status: 404 }),
		).status,
		404,
	);
});

test("tags a download by its own bytes and keeps its headers", () => {
	const csv = "code,name\nE05000001,Central\n";
	const response = httpResponse({ method: "GET", headers: {} }, () => ({
		...ok,
		representation: {
			contentType: "text/csv; charset=utf-8",
			body: csv,
			headers: { "content-disposition": 'attachment; filename="x.csv"' },
		},
	}));
	assert.equal(response.body, csv);
	assert.equal(response.headers.etag, entityTag(csv));
	assert.equal(response.headers["content-type"], "text/csv; charset=utf-8");
	assert.equal(
		response.headers["content-disposition"],
		'attachment; filename="x.csv"',
	);
});

test("answers a failed tabular request with a JSON problem", () => {
	// A caller asking for CSV still gets the problem as JSON: an error is not
	// a representation of the resource it failed to serve.
	const catalogues = readApiCatalogues(
		resolve(dirname(fileURLToPath(import.meta.url)), ".."),
	);
	const response = httpResponse({ method: "GET", headers: {} }, (method) =>
		route(
			method,
			"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&format=csv&cursor=not-a-cursor",
			catalogues,
		),
	);
	assert.equal(response.status, 400);
	assert.equal(response.headers["content-type"], "application/problem+json");
	assert.equal(response.headers["cache-control"], "no-store");
	assert.equal(response.headers.etag, undefined);
	const problem = JSON.parse(String(response.body ?? "{}")) as {
		code?: string;
	};
	assert.equal(problem.code, "invalid_cursor");

	// The same request without the bad cursor is served as CSV, so the
	// difference is the failure and not the route.
	const served = httpResponse({ method: "GET", headers: {} }, (method) =>
		route(
			method,
			"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&format=csv&limit=1",
			catalogues,
		),
	);
	assert.equal(served.status, 200);
	assert.equal(served.headers["content-type"], "text/csv; charset=utf-8");
});

test("serves a binary representation as its own bytes", () => {
	// A vector tile is gzipped protobuf, so the pipeline must not put it
	// through a string: the bytes served and the validator must be the tile's.
	const tile = Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xff, 0xfe, 0x00, 0x7f]);
	const response = httpResponse({ method: "GET", headers: {} }, () => ({
		status: 200,
		body: ok.body,
		representation: {
			contentType: "application/vnd.mapbox-vector-tile",
			body: tile,
		},
	}));
	assert.equal(response.status, 200);
	assert.deepEqual(response.body, tile);
	assert.equal(response.headers["content-length"], String(tile.length));
	assert.equal(
		response.headers.etag,
		`"sha256-${createHash("sha256").update(tile).digest("base64url")}"`,
	);
	assert.equal(
		response.headers["content-type"],
		"application/vnd.mapbox-vector-tile",
	);
});

test("caches an empty answer but sends nothing to revalidate", () => {
	// A tile covering no area is an ordinary answer for a renderer, not a
	// failure, so it is stored rather than refetched every time.
	const response = httpResponse({ method: "GET", headers: {} }, () => ({
		status: 204,
		body: ok.body,
		representation: {
			contentType: "application/vnd.mapbox-vector-tile",
			body: Buffer.alloc(0),
		},
	}));
	assert.equal(response.status, 204);
	assert.equal(response.body, undefined);
	assert.equal(response.headers["content-length"], undefined);
	assert.equal(response.headers.etag, undefined);
	assert.equal(
		response.headers["cache-control"],
		"public, max-age=300, must-revalidate",
	);
});

test("lets a map in someone else's page read the response", () => {
	// The obvious client for this API is a renderer on another origin. Without
	// these a browser fetches a tile and then refuses to let the page read it,
	// and a conditional request never leaves the browser at all.
	const response = httpResponse({ method: "GET", headers: {} }, () => ok);
	assert.equal(response.headers["access-control-allow-origin"], "*");
	for (const exposed of ["etag", "link"])
		assert.match(
			response.headers["access-control-expose-headers"]!,
			new RegExp(exposed),
			`${exposed} must be readable or a client cannot use it`,
		);

	// A 304 carries them too: a revalidated tile is still a cross-origin read.
	const revalidated = httpResponse(
		{ method: "GET", headers: { "if-none-match": entityTag(body) } },
		() => ok,
	);
	assert.equal(revalidated.status, 304);
	assert.equal(revalidated.headers["access-control-allow-origin"], "*");
});

test("answers a preflight for a conditional cross-origin request", () => {
	// `If-None-Match` is not safelisted, so a browser asks first. If the answer
	// does not allow it, every conditional request silently becomes a full one.
	const preflight = preflightResponse();
	assert.equal(preflight.status, 204);
	assert.equal(preflight.body, undefined);
	assert.equal(preflight.headers["access-control-allow-origin"], "*");
	assert.match(preflight.headers["access-control-allow-methods"]!, /GET/);
	assert.match(
		preflight.headers["access-control-allow-headers"]!,
		/if-none-match/,
	);
});
