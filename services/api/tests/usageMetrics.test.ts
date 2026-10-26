import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import test, { type TestContext } from "node:test";
import { createApiServer } from "../src/apiServer";
import { createOperationMatcher } from "../src/operationTemplates";
import { compileOperations } from "../scripts/build-operations";
import type { ServerOptions } from "../src/serverOptions";
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
