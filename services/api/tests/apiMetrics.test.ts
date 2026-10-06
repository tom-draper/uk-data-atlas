import assert from "node:assert/strict";
import test from "node:test";
import { ApiMetrics } from "../src/apiMetrics";

test("exports the location projection cache's shards and events", (t) => {
	const metrics = new ApiMetrics(
		"release",
		() => undefined,
		() => ({
			maxShards: 8,
			loadedShards: ["first", "second"],
			reads: 5,
			loads: 3,
			evictions: 1,
			loadSeconds: 0.25,
		}),
	);
	t.after(() => metrics.close());
	const text = metrics.render();
	assert.match(
		text,
		/^atlas_api_location_projection_cache_shards\{kind="loaded"\} 2$/m,
	);
	assert.match(
		text,
		/^atlas_api_location_projection_cache_shards\{kind="limit"\} 8$/m,
	);
	assert.match(
		text,
		/^atlas_api_location_projection_cache_events_total\{event="eviction"\} 1$/m,
	);
	assert.match(
		text,
		/^atlas_api_location_projection_cache_load_seconds_total 0.25$/m,
	);
});

test("leaves the location projection cache out when there is none", (t) => {
	const metrics = new ApiMetrics("release");
	t.after(() => metrics.close());
	assert.doesNotMatch(metrics.render(), /location_projection_cache/);
});
