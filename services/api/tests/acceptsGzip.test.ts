import assert from "node:assert/strict";
import test from "node:test";
import { acceptsGzip, httpResponse } from "../src/httpResponse";
import { envelope } from "@uk-data-atlas/atlas-runtime/api";

test("uses an explicit gzip preference before the wildcard", () => {
	for (const header of [
		"gzip;q=0, *;q=1",
		"*;q=1, gzip;q=0",
		"GZIP;Q=0, *",
		["*;q=1", "gzip;q=0"],
	]) {
		assert.equal(acceptsGzip(header), false, String(header));
	}
	for (const header of ["gzip;q=0.5, *;q=0", "*;q=0, gzip", "*"]) {
		assert.equal(acceptsGzip(header), true, header);
	}
});

test("decodes a stored gzip file when gzip is explicitly refused", () => {
	const response = httpResponse(
		{ method: "GET", headers: { "accept-encoding": "gzip;q=0, *" } },
		() => ({
			status: 200,
			body: envelope("sha256:release", {}),
			representation: {
				contentType: "application/geo+json",
				body: {
					path: "/release.geojson.gz",
					bytes: 1000,
					gzipBytes: 120,
					contentHash: `sha256:${"ab".repeat(32)}`,
				},
			},
		}),
	);
	assert.equal(response.headers["content-encoding"], undefined);
	assert.equal(response.headers["content-length"], "1000");
	assert.deepEqual(response.body, {
		path: "/release.geojson.gz",
		bytes: 1000,
		gunzip: true,
	});
});

test("generated GeoJSON preserves encoding validators and ignores byte ranges", () => {
	const body = Buffer.from(
		JSON.stringify({
			type: "FeatureCollection",
			padding: "x".repeat(2048),
			features: [],
		}),
	);
	const reply = () => ({
		status: 200,
		body: envelope("release", {}),
		representation: {
			contentType: "application/geo+json",
			body,
			contentHash: "ab".repeat(32),
		},
	});
	const plain = httpResponse(
		{
			method: "GET",
			headers: { range: "bytes=0-9", "accept-encoding": "identity" },
		},
		reply,
	);
	const gzip = httpResponse(
		{ method: "GET", headers: { "accept-encoding": "gzip" } },
		reply,
	);
	assert.equal(plain.status, 200);
	assert.equal(plain.headers["accept-ranges"], undefined);
	assert.equal(plain.headers["content-length"], String(body.length));
	assert.equal(gzip.headers["content-encoding"], "gzip");
	assert.equal(gzip.headers.vary, "accept-encoding");
	assert.notEqual(plain.headers.etag, gzip.headers.etag);
	assert.equal(
		httpResponse(
			{
				method: "GET",
				headers: {
					"accept-encoding": "gzip",
					"if-none-match": gzip.headers.etag,
				},
			},
			reply,
		).status,
		304,
	);
});

test("generated Parquet supports byte ranges under its published validator", () => {
	const body = Buffer.from("PAR1abcdefghPAR1");
	const result = httpResponse(
		{ method: "GET", headers: { range: "bytes=4-7" } },
		() => ({
			status: 200,
			body: envelope("release", {}),
			representation: {
				contentType: "application/vnd.apache.parquet",
				body,
				contentHash: "ab".repeat(32),
			},
		}),
	);
	assert.equal(result.status, 206);
	assert.equal(result.headers["content-range"], `bytes 4-7/${body.length}`);
	assert.deepEqual(result.body, Buffer.from("abcd"));
});
