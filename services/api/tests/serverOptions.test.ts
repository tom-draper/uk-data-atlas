import assert from "node:assert/strict";
import test from "node:test";
import { readServeConfiguration } from "../src/serverOptions";

test("keeps 32 MB of answers by default and lets the cache be sized or turned off", () => {
	assert.equal(
		readServeConfiguration({}).server.responseCacheBytes,
		32 * 1024 * 1024,
	);
	assert.equal(
		readServeConfiguration({ ATLAS_RESPONSE_CACHE_MB: "8" }).server
			.responseCacheBytes,
		8 * 1024 * 1024,
	);
	assert.equal(
		readServeConfiguration({ ATLAS_RESPONSE_CACHE_MB: "0" }).server
			.responseCacheBytes,
		0,
	);
});

test("stops rather than guess at a malformed response cache size", () => {
	for (const value of ["-1", "1.5", "lots", "5000"])
		assert.throws(
			() => readServeConfiguration({ ATLAS_RESPONSE_CACHE_MB: value }),
			/ATLAS_RESPONSE_CACHE_MB/,
		);
});
