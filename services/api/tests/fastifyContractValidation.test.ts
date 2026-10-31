import { validateContractResponse } from "../src/contract/validateResponse";
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { z } from "zod";
import { envelope } from "@uk-data-atlas/atlas-runtime/api";
import { registerGetRoute } from "../src/contract/registerGetRoute";

test("the contract rejects an invalid successful response before sending it", async () => {
	const app = Fastify();
	registerGetRoute(
		app,
		{
			boundaryRegistry: {
				schemaVersion: 1,
				contentHash: "test",
				releases: [],
			},
		},
		{
			method: "get",
			path: "/test",
			operationId: "test",
			responses: {
				200: {
					description: "Test",
					content: {
						"application/json": {
							schema: z.object({
								data: z.object({ value: z.string() }),
							}),
						},
					},
				},
			},
		},
		() => ({ status: 200, body: envelope("test", { value: 123 }) }),
	);
	try {
		const response = await app.inject("/test");
		assert.equal(response.statusCode, 500);
		assert.doesNotMatch(response.body, /"value":123/);
	} finally {
		await app.close();
	}
});

test("validates the public JSON names emitted by the server", async () => {
	const app = Fastify();
	registerGetRoute(
		app,
		{
			boundaryRegistry: {
				schemaVersion: 1,
				contentHash: "test",
				releases: [],
			},
		},
		{
			method: "get",
			path: "/years",
			operationId: "years",
			responses: {
				200: {
					description: "Years",
					content: {
						"application/json": {
							schema: z.object({
								data: z.object({
									codeYears: z.array(z.number()),
								}),
							}),
						},
					},
				},
			},
		},
		() => ({
			status: 200,
			body: envelope("test", { boundaryYears: [2024] }),
		}),
	);
	try {
		const response = await app.inject("/years");
		assert.equal(response.statusCode, 200);
		assert.deepEqual(response.json().data, { codeYears: [2024] });
	} finally {
		await app.close();
	}
});

test("boundary join responses do not use the release detail schema", () => {
	const response = {
		status: 200,
		body: {
			apiVersion: "v1",
			atlasRelease: "test",
			meta: { nextCursor: null },
			data: { matched: 1 },
		},
	} as const;
	assert.equal(
		validateContractResponse(
			["v1", "boundary-releases", "ward", "2025:join"],
			response,
		),
		response,
	);
});
