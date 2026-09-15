import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { entityTag, httpResponse, matchesEntityTag } from "../src/httpResponse";
import type { ApiResponse } from "../src/routeResponse";

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
