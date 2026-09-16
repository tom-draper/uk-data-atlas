import assert from "node:assert/strict";
import test from "node:test";
import { route } from "../src/routes";
import type { BoundaryRegistry } from "../src/boundaryRegistry";

const boundaryRegistry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [],
};

test("serves the OpenAPI description as the document itself", () => {
	const openapiDocument = 'openapi: 3.1.0\ninfo:\n  title: "Test"\n';
	const response = route("GET", "/v1/openapi.yaml", {
		boundaryRegistry,
		openapiDocument,
	});
	assert.equal(response.status, 200);
	assert.deepEqual(response.representation, {
		contentType: "application/yaml",
		body: openapiDocument,
	});
	// The envelope names the document, for a caller that asked for JSON.
	assert.deepEqual("data" in response.body && response.body.data, {
		title: "UK Data Atlas API",
		format: "openapi-3.1",
		href: "/v1/openapi.yaml",
	});
});

test("reports the description as unavailable when the server has none", () => {
	const response = route("GET", "/v1/openapi.yaml", { boundaryRegistry });
	assert.equal(response.status, 503);
	assert.equal(
		"title" in response.body && response.body.title,
		"Description Unavailable",
	);
});
