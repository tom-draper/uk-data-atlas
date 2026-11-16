import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { createOperationMatcher } from "../src/runtime/index.ts";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import { compileOperations } from "./pipelineFixtures";
import { atlasRelease, testContext } from "./routeFixtures";

const openapiDocument = readFileSync(
	new URL("../openapi.yaml", import.meta.url),
	"utf8",
);
const operationMatcher = createOperationMatcher(
	compileOperations(openapiDocument).operations,
);
const context = testContext({
	atlasRelease,
	openapiDocument,
	operationMatcher,
	documents: new Map([
		["fixture", { body: '{"value":1}\n', contentHash: "fixture" }],
		["measure-population", { body: "{}", contentHash: "sha256:abc" }],
	]),
});

const plain = {
	"accept-encoding": "identity",
	origin: "https://example.test",
};

test("evidence documents keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, context);
	const fixture = await send({ path: "/v1/documents/fixture.json" });
	const etag =
		fixture.headers.find((line) => line.startsWith("etag: "))?.slice(6) ??
		"";
	const requests: CharacterizedRequest[] = [
		{ path: "/v1/documents/fixture.json", headers: plain },
		{ path: "/v1/documents/fixture.json", method: "HEAD" },
		{
			path: "/v1/documents/fixture.json",
			headers: { "if-none-match": etag },
		},
		{
			path: "/v1/documents/fixture.json",
			headers: { "accept-encoding": "gzip" },
		},
		{ path: "/v1/documents/measure-population.json" },
		{ path: "/v1/documents/missing.json" },
		{ path: "/v1/documents/missing.json", method: "HEAD" },
		{ path: "/v1/documents/fixture.json?unexpected=1" },
		{ path: "/v1/documents/fixture.json/" },
		{ path: "/v1/documents/fixture" },
		{ path: "/v1/documents/fixture.JSON" },
		{ path: "/v1/documents/.json" },
		{ path: "/v1/documents/..json" },
		{ path: "/v1/documents/%66ixture.json" },
		{ path: "/v1/documents/a%2Fb.json" },
		{ path: "/v1/documents/%E0%A4%A.json" },
		{ path: `/v1/documents/${"x".repeat(150)}.json` },
		{ path: "/v1/documents/fixture.json/extra" },
		{ path: "/v1/documents" },
		{ path: "/v1/documents/" },
		{
			path: "/v1/documents/fixture.json",
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		},
		{ path: "/v1/documents/missing.json", method: "OPTIONS" },
		...["POST", "PUT", "PATCH", "DELETE"].flatMap((method) => [
			{ path: "/v1/documents/fixture.json", method },
			{ path: "/v1/documents/missing.json", method },
		]),
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});
