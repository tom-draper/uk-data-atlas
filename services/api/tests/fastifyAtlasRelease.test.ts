import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import Fastify from "fastify";
import { atlasReleaseEnvelope } from "../src/contract/atlasRelease";
import { atlasReleaseRoutes } from "../src/contract/atlasReleaseRoutes";
import { httpResponse } from "../src/httpResponse";
import { route } from "../src/routes";
import { testContext } from "./routeFixtures";

const boundaryRegistry = {
	schemaVersion: 1 as const,
	contentHash: "sha256:registry",
	releases: [],
};

test("Fastify serves the Atlas release with the existing HTTP contract", async () => {
	const atlasRelease = {
		schemaVersion: 1 as const,
		releaseId: "sha256:release",
		artifacts: [],
	};
	const context = testContext({ boundaryRegistry, atlasRelease });
	const app = Fastify({ exposeHeadRoutes: false });
	await app.register(atlasReleaseRoutes, { prefix: "/v1", context });
	try {
		const response = await app.inject("/v1/atlas-release");
		const expected = httpResponse({ method: "GET", headers: {} }, () =>
			route("GET", "/v1/atlas-release", context),
		);
		assert.equal(response.statusCode, expected.status);
		assert.equal(response.body, expected.body);
		assert.deepEqual(
			atlasReleaseEnvelope.parse(response.json()).data,
			atlasRelease,
		);
		assert.equal(response.headers.etag, expected.headers.etag);
		const cached = await app.inject({
			url: "/v1/atlas-release",
			headers: { "if-none-match": response.headers.etag! },
		});
		assert.equal(cached.statusCode, 304);
		const head = await app.inject({
			method: "HEAD",
			url: "/v1/atlas-release",
		});
		assert.equal(head.statusCode, 200);
		assert.equal(head.body, "");
	} finally {
		await app.close();
	}
});

test("Fastify reports an unavailable Atlas release", async () => {
	const app = Fastify();
	await app.register(atlasReleaseRoutes, {
		prefix: "/v1",
		context: { boundaryRegistry },
	});
	try {
		const response = await app.inject("/v1/atlas-release");
		assert.equal(response.statusCode, 503);
		assert.equal(response.json().title, "Catalogue Unavailable");
	} finally {
		await app.close();
	}
});

test("Fastify rejects an undeclared query as the current dispatcher does", async () => {
	const openapiDocument = readFileSync(
		new URL("../openapi.yaml", import.meta.url),
		"utf8",
	);
	const context = testContext({ boundaryRegistry, openapiDocument });
	const app = Fastify();
	await app.register(atlasReleaseRoutes, { prefix: "/v1", context });
	try {
		const response = await app.inject("/v1/atlas-release?unexpected=1");
		const expected = route(
			"GET",
			"/v1/atlas-release?unexpected=1",
			context,
		);
		assert.equal(response.statusCode, 400);
		assert.deepEqual(response.json(), expected.body);
	} finally {
		await app.close();
	}
});
