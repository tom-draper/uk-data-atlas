import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import Fastify from "fastify";
import { documentationRoutes } from "../src/contract/documentationRoutes";
import { httpResponse } from "../src/httpResponse";
import { route } from "../src/routes";
import { testContext } from "./routeFixtures";
import { createContractApp } from "../src/contract/generatedRoutes";

const boundaryRegistry = {
	schemaVersion: 1 as const,
	contentHash: "sha256:test",
	releases: [],
};

test("Fastify serves the description and documentation", async () => {
	const openapiDocument = readFileSync(
		new URL("../openapi.yaml", import.meta.url),
		"utf8",
	);
	const app = await createContractApp({
		boundaryRegistry,
		openapiDocument,
	});
	try {
		const description = await app.inject("/openapi.yaml");
		assert.equal(description.statusCode, 200);
		assert.equal(description.headers["content-type"], "application/yaml");
		assert.equal(description.body, openapiDocument);
		const docs = await app.inject("/docs");
		assert.equal(docs.statusCode, 200);
		assert.match(docs.headers["content-type"]!, /^text\/html/);
		assert.match(docs.body, /UK Data Atlas/);
	} finally {
		await app.close();
	}
});

test("Fastify reports a missing description", async () => {
	const app = await createContractApp({ boundaryRegistry });
	try {
		for (const url of ["/openapi.yaml", "/docs"]) {
			const response = await app.inject(url);
			assert.equal(response.statusCode, 503);
			assert.match(
				response.headers["content-type"]!,
				/^application\/problem\+json/,
			);
			assert.equal(response.json().title, "Description Unavailable");
		}
	} finally {
		await app.close();
	}
});

test("the documentation plugin mounts under v1 and preserves HTTP behaviour", async () => {
	const openapiDocument = readFileSync(
		new URL("../openapi.yaml", import.meta.url),
		"utf8",
	);
	const app = Fastify({ exposeHeadRoutes: false });
	await app.register(documentationRoutes, {
		prefix: "/v1",
		context: { boundaryRegistry, openapiDocument },
	});
	try {
		const response = await app.inject({
			method: "GET",
			url: "/v1/openapi.yaml",
		});
		const expected = httpResponse({ method: "GET", headers: {} }, () =>
			route(
				"GET",
				"/v1/openapi.yaml",
				testContext({ boundaryRegistry, openapiDocument }),
			),
		);
		assert.equal(response.statusCode, expected.status);
		assert.equal(response.body, expected.body);
		for (const [name, value] of Object.entries(expected.headers))
			assert.equal(response.headers[name], value, name);
		const head = await app.inject({
			method: "HEAD",
			url: "/v1/openapi.yaml",
		});
		assert.equal(head.statusCode, 200);
		assert.equal(head.body, "");
		assert.equal(head.headers.etag, response.headers.etag);
		const cached = await app.inject({
			method: "GET",
			url: "/v1/openapi.yaml",
			headers: { "if-none-match": response.headers.etag! },
		});
		assert.equal(cached.statusCode, 304);
		assert.equal(cached.body, "");
		const compressed = await app.inject({
			method: "GET",
			url: "/v1/openapi.yaml",
			headers: { "accept-encoding": "gzip" },
		});
		assert.equal(compressed.statusCode, 200);
		assert.equal(compressed.headers["content-encoding"], "gzip");
		assert.equal(
			gunzipSync(compressed.rawPayload).toString(),
			openapiDocument,
		);
	} finally {
		await app.close();
	}
});

test("documentation routes reject undeclared query parameters", async () => {
	const openapiDocument = readFileSync(
		new URL("../openapi.yaml", import.meta.url),
		"utf8",
	);
	const context = testContext({ boundaryRegistry, openapiDocument });
	const app = Fastify();
	await app.register(documentationRoutes, { prefix: "/v1", context });
	try {
		for (const path of ["/v1/docs", "/v1/openapi.yaml"]) {
			const url = `${path}?unexpected=1`;
			for (const method of ["GET", "HEAD"] as const) {
				const response = await app.inject({ method, url });
				const expected = httpResponse({ method, headers: {} }, () =>
					route("GET", url, context),
				);
				assert.equal(response.statusCode, expected.status);
				assert.equal(response.body, expected.body ?? "");
			}
		}
	} finally {
		await app.close();
	}
});
