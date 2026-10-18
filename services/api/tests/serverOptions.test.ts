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

test("defaults to two workers and validates deployment origins", () => {
	assert.equal(readServeConfiguration({}).workers, 2);
	assert.equal(readServeConfiguration({ ATLAS_WORKERS: "1" }).workers, 1);
	for (const value of ["0", "1.5", "33"])
		assert.throws(
			() => readServeConfiguration({ ATLAS_WORKERS: value }),
			/ATLAS_WORKERS/,
		);
	assert.equal(
		readServeConfiguration({
			ATLAS_MAP_ASSET_BASE_URL: "https://maps.example.com/release/",
		}).mapAssetBaseUrl,
		"https://maps.example.com/release",
	);
	for (const value of [
		"file:///tmp/maps",
		"https://user:pass@example.com",
		"https://example.com/?token=secret",
	])
		assert.throws(() =>
			readServeConfiguration({ ATLAS_MAP_ASSET_BASE_URL: value }),
		);
});

test("bounds the crosswalk cache and allows disabling retention", () => {
	assert.equal(
		readServeConfiguration({}).crosswalkCacheBytes,
		64 * 1024 * 1024,
	);
	assert.equal(
		readServeConfiguration({ ATLAS_CROSSWALK_CACHE_MB: "8" })
			.crosswalkCacheBytes,
		8 * 1024 * 1024,
	);
	assert.equal(
		readServeConfiguration({ ATLAS_CROSSWALK_CACHE_MB: "0" })
			.crosswalkCacheBytes,
		0,
	);
	for (const value of ["-1", "1.5", "many", "4097"])
		assert.throws(
			() => readServeConfiguration({ ATLAS_CROSSWALK_CACHE_MB: value }),
			/ATLAS_CROSSWALK_CACHE_MB/,
		);
});

test("bounds concurrent requests per worker", () => {
	assert.equal(readServeConfiguration({}).server.maxConcurrentRequests, 16);
	assert.equal(
		readServeConfiguration({ ATLAS_MAX_CONCURRENT_REQUESTS: "2" }).server
			.maxConcurrentRequests,
		2,
	);
	for (const value of ["0", "-1", "1.5", "many", "1025"])
		assert.throws(
			() =>
				readServeConfiguration({
					ATLAS_MAX_CONCURRENT_REQUESTS: value,
				}),
			/ATLAS_MAX_CONCURRENT_REQUESTS/,
		);
});
