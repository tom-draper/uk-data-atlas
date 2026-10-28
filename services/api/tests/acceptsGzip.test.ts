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
