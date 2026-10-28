import assert from "node:assert/strict";
import { once } from "node:events";
import {
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import { createApiServer } from "../src/apiServer";
import { createOperationMatcher } from "@uk-data-atlas/atlas-runtime/api";
import { compileOperations } from "../../../pipeline/src/build-operations";
import type { ServerOptions } from "../src/serverOptions";
import { UsageStore } from "../src/usageStore";
import {
	atlasRelease,
	compatibleWardAreaLookup,
	dataCatalog,
	registry,
	testContext,
} from "./routeFixtures";

const openapiDocument = readFileSync(
	new URL("../openapi.yaml", import.meta.url),
	"utf8",
);
const operationMatcher = createOperationMatcher(
	compileOperations(openapiDocument).operations,
);

const serve = async (t: TestContext, options: ServerOptions = {}) => {
	const server = createApiServer(
		testContext({
			atlasRelease,
			dataCatalog,
			openapiDocument,
			operationMatcher,
			areaLookup: compatibleWardAreaLookup,
		}),
		options,
	);
	await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
	t.after(() => {
		server.close();
	});
	const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
	return {
		server,
		get: async (path: string) => {
			const response = await fetch(`${base}${path}`);
			return { status: response.status, text: await response.text() };
		},
	};
};

const measure = dataCatalog.measures[0]!.id;
const release = registry.releases[0]!;

test("counts requests by outcome, measure, area and kind of absence", async (t) => {
	const { get } = await serve(t, { metrics: "open" });
	await get(`/v1/data/${measure}`);
	await get("/v1/data/not-a-measure-we-publish");
	await get(`/v1/areas/${release.geography}/${release.id}/E05000001`);
	await get(`/v1/areas/${release.geography}/1999-01-gone/E05000001`);
	await get("/v1/postcodes/SW1A1AA");
	await get("/v1/places?q=Birmingham");
	await get("/v1/no/such/route");
	const text = (await get("/metrics")).text.split("\n");

	const has = (line: string) =>
		assert.ok(text.includes(line), `missing ${line}`);
	has('atlas_api_usage_measures_total{measure="unknown"} 1');
	assert.ok(
		text.some((line) =>
			line.startsWith(
				`atlas_api_usage_measures_total{measure="${measure}"}`,
			),
		),
	);
	has(
		`atlas_api_usage_areas_total{geography="${release.geography}",release="${release.id}"} 1`,
	);
	has(
		`atlas_api_usage_areas_total{geography="${release.geography}",release="unknown"} 1`,
	);
	has(
		'atlas_api_usage_not_found_total{route="/v1/data/{measure-id}",kind="unknown-measure"} 1',
	);
	has(
		'atlas_api_usage_not_found_total{route="unmatched",kind="unmatched-route"} 1',
	);
	assert.ok(
		text.some((line) =>
			/^atlas_api_usage_outcomes_total\{route="\/v1\/places",outcome="2xx",problem="none"\} 1$/.test(
				line,
			),
		),
	);
	// A scrape is the operator's, not a question about the data.
	assert.ok(!text.some((line) => /^atlas_api_usage_.*\/metrics/.test(line)));
	// The existing series are untouched.
	assert.ok(
		text.some((line) => line.startsWith("atlas_api_requests_total{")),
	);
});

test("leaves nothing a caller typed in the metrics", async (t) => {
	const { get } = await serve(t, { metrics: "open" });
	await get("/v1/postcodes/SW1A1AA");
	await get("/v1/places?q=10%20Downing%20Street");
	await get(`/v1/data/${measure}/value?place=Birmingham&lat=51.5&lon=-0.1`);
	await get("/v1/data/SW1A%201AA");
	const text = (await get("/metrics")).text;
	assert.doesNotMatch(text, /SW1A|Downing|Birmingham|51\.5|127\.0\.0\.1/i);
});

const usageDirectory = (t: TestContext) => {
	const path = mkdtempSync(join(tmpdir(), "usage-server-"));
	t.after(() => rmSync(path, { recursive: true, force: true }));
	return path;
};

const usage = (directory: string) => ({
	directory,
	flushIntervalMs: 3_600_000,
	retentionDays: 400,
});

const stopped = async (server: ReturnType<typeof createApiServer>) => {
	server.close();
	await once(server, "close");
};

const today = () => new Date().toISOString().slice(0, 10);

test("keeps daily counts across a server restart", async (t) => {
	const directory = usageDirectory(t);
	for (let run = 0; run < 2; run++) {
		const { server, get } = await serve(t, { usage: usage(directory) });
		await get(`/v1/measures/${measure}`);
		await get("/v1/measures/not-a-measure-we-publish");
		await stopped(server);
	}
	const reader = UsageStore.openReadOnly(directory);
	t.after(() => reader.close());
	assert.deepEqual(
		reader.totals(today(), ["measure"], { present: ["measure"] }),
		[
			{ measure, requests: 2, failed: 0 },
			{ measure: "unknown", requests: 2, failed: 2 },
		].sort(
			(a, b) =>
				b.requests - a.requests || a.measure.localeCompare(b.measure),
		),
	);
	assert.deepEqual(
		reader.totals(today(), ["route", "notFound"], {
			present: ["notFound"],
		}),
		[
			{
				route: "/v1/measures/{measure-id}",
				notFound: "unknown-measure",
				requests: 2,
				failed: 2,
			},
		],
	);
});

test("writes counts only when flushed, not per request", async (t) => {
	const directory = usageDirectory(t);
	const { server, get } = await serve(t, { usage: usage(directory) });
	await get(`/v1/data/${measure}`);
	const reader = UsageStore.openReadOnly(directory);
	t.after(() => reader.close());
	assert.deepEqual(reader.totals("2000-01-01", ["route"]), []);
	server.flushUsage();
	assert.equal(reader.totals("2000-01-01", ["route"]).length, 1);
});

test("stores no trace of a postcode, place, coordinates or caller", async (t) => {
	const directory = usageDirectory(t);
	const { server, get } = await serve(t, { usage: usage(directory) });
	await get("/v1/postcodes/SW1A1AA");
	await get("/v1/postcodes:batch?geography=Birmingham");
	await get("/v1/places?q=10%20Downing%20Street");
	await get(
		`/v1/data/${measure}/value?place=Birmingham&lat=51.5034&lon=-0.1276`,
	);
	await get("/v1/data/SW1A%201AA");
	await get(`/v1/areas/${release.geography}/${release.id}/E05000001?x=Leeds`);
	await stopped(server);

	// Everything the store left on disk, including its write-ahead log.
	const bytes = readdirSync(directory)
		.map((name) => readFileSync(join(directory, name)).toString("latin1"))
		.join("\n");
	assert.ok(bytes.length > 0);
	assert.doesNotMatch(
		bytes,
		/SW1A|Downing|Birmingham|Leeds|51\.5034|0\.1276|127\.0\.0\.1|localhost|E05000001/i,
	);
	// What it does hold is routes, outcomes and catalogue ids.
	const reader = UsageStore.openReadOnly(directory);
	t.after(() => reader.close());
	const routes = reader
		.totals("2000-01-01", ["route"])
		.map(({ route }) => route ?? "")
		.sort();
	assert.ok(routes.includes("/v1/postcodes/{postcode}"));
	assert.ok(routes.includes("/v1/places"));
	assert.ok(
		routes.every((route) =>
			/^(\/v1(\/[a-z{}:.-]+)*|unmatched)$/i.test(route),
		),
	);
});

test("answers normally when the usage directory cannot be opened", async (t) => {
	const directory = usageDirectory(t);
	const logged: string[] = [];
	writeFileSync(join(directory, "blocker"), "");
	const { get } = await serve(t, {
		// A path inside a file, which no directory can be made at.
		usage: usage(join(directory, "blocker", "inside")),
		log: (entry) => logged.push(entry.event),
	});
	const first = await get("/v1/geographies");
	assert.equal(first.status, 200);
	assert.deepEqual(logged, ["usage.store_unavailable"]);
});
