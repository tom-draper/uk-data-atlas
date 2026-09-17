import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { jsonLog, readServeConfiguration } from "../src/serverOptions";

test("defaults to a limited, logged single public instance", () => {
	const configuration = readServeConfiguration({});
	assert.equal(configuration.port, 3001);
	assert.equal(configuration.host, "127.0.0.1");
	assert.equal(configuration.geometryCacheReleases, 2);
	assert.deepEqual(configuration.server.rateLimit, {
		capacity: 600,
		refillPerSecond: 10,
		trustedProxyHops: 0,
	});
	assert.equal(configuration.server.accessLog, true);
	assert.equal(configuration.server.metricsToken, undefined);
});

test("reads every setting from the environment", () => {
	const configuration = readServeConfiguration({
		PORT: "8080",
		HOST: "0.0.0.0",
		ATLAS_GEOMETRY_CACHE_RELEASES: "4",
		ATLAS_RATE_LIMIT_CAPACITY: "100",
		ATLAS_RATE_LIMIT_REFILL_PER_SECOND: "0.5",
		ATLAS_TRUSTED_PROXY_HOPS: "2",
		ATLAS_ACCESS_LOG: "off",
		ATLAS_METRICS_TOKEN: "token",
		ATLAS_MAX_URL_LENGTH: "2048",
		ATLAS_SHUTDOWN_GRACE_SECONDS: "30",
	});
	assert.equal(configuration.port, 8080);
	assert.equal(configuration.geometryCacheReleases, 4);
	assert.equal(configuration.shutdownGraceSeconds, 30);
	assert.deepEqual(configuration.server.rateLimit, {
		capacity: 100,
		refillPerSecond: 0.5,
		trustedProxyHops: 2,
	});
	assert.equal(configuration.server.accessLog, false);
	assert.equal(configuration.server.metricsToken, "token");
	assert.equal(configuration.server.maxUrlLength, 2048);
	assert.equal(
		readServeConfiguration({ ATLAS_RATE_LIMIT_CAPACITY: "0" }).server
			.rateLimit,
		undefined,
	);
});

test("refuses a malformed setting rather than quietly using the default", () => {
	for (const env of [
		{ PORT: "70000" },
		{ ATLAS_GEOMETRY_CACHE_RELEASES: "0" },
		{ ATLAS_RATE_LIMIT_CAPACITY: "many" },
		{ ATLAS_RATE_LIMIT_REFILL_PER_SECOND: "-1" },
		{ ATLAS_ACCESS_LOG: "sometimes" },
		{ ATLAS_MAX_URL_LENGTH: "10" },
	])
		assert.throws(() => readServeConfiguration(env), Object.keys(env)[0]);
});

test("writes one JSON object per log line", () => {
	const lines: string[] = [];
	jsonLog((line) => lines.push(line))({
		level: "info",
		event: "request",
		status: 200,
	});
	assert.equal(lines.length, 1);
	assert.ok(lines[0]!.endsWith("\n"));
	const entry = JSON.parse(lines[0]!);
	assert.equal(entry.event, "request");
	assert.match(entry.time, /^\d{4}-\d{2}-\d{2}T/);
});

test("documents exactly the settings the server reads", () => {
	const source = readFileSync(
		new URL("../src/serverOptions.ts", import.meta.url),
		"utf8",
	);
	const read = new Set(
		[...source.matchAll(/(?:"|env\.)(PORT|HOST|ATLAS_[A-Z_]+)\b/g)].map(
			(match) => match[1],
		),
	);
	const readme = readFileSync(
		new URL("../README.md", import.meta.url),
		"utf8",
	);
	const section = /^### Configuration\n([\s\S]*?)^### /m.exec(readme)?.[1];
	assert.ok(section, "README has no Configuration section");
	const documented = new Set(
		[...section.matchAll(/^\| `([A-Z_]+)` \|/gm)].map((match) => match[1]),
	);
	assert.deepEqual([...documented].sort(), [...read].sort());
});
