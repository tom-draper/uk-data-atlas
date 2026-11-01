import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";
import { schemaViolations } from "./openapiSchema";
import { generatedPaths } from "../src/contract/generatedRoutes";
import { route } from "../src/routes";
import { testContext } from "./routeFixtures";
import { renderOpenapi } from "../src/contract/renderOpenapi";

const document = parse(
	readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8"),
);

test("generated route contracts match the published description", async () => {
	const paths = await generatedPaths();
	assert.deepEqual(Object.keys(paths), [
		"/openapi.yaml",
		"/docs",
		"/atlas-release",
		"/datasets",
		"/datasets/{dataset-id}",
		"/measures",
		"/measures/{measure-id}",
		"/boundaries",
		"/boundary-releases",
		"/boundary-releases/{geography}/{release}",
		"/boundary-releases:resolve",
		"/boundary-releases:compare",
	]);
	for (const [path, item] of Object.entries(paths)) {
		assert.deepEqual(document.paths[path], item, path);
	}
});

test("the generated route sections are up to date", () => {
	const result = spawnSync(
		process.execPath,
		["--import", "tsx", "scripts/generate-openapi.ts", "--check"],
		{
			cwd: new URL("..", import.meta.url),
			encoding: "utf8",
		},
	);
	assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("generation repairs a stale section without changing other paths", async () => {
	const source = readFileSync(
		new URL("../openapi.yaml", import.meta.url),
		"utf8",
	);
	const stale = source.replace(
		"summary: The human documentation landing page",
		"summary: stale",
	);
	assert.notEqual(stale, source);
	assert.equal(await renderOpenapi(stale), source);
	assert.equal(await renderOpenapi(source), source);
});

test("generation refuses a missing registered path", async () => {
	const source = readFileSync(
		new URL("../openapi.yaml", import.meta.url),
		"utf8",
	);
	await assert.rejects(
		() => renderOpenapi(source.replace("  /docs:\n", "  /old-docs:\n")),
		/Missing path: \/docs/,
	);
});

test("generation repairs stale release components", async () => {
	const source = readFileSync(
		new URL("../openapi.yaml", import.meta.url),
		"utf8",
	);
	const stale = source.replace(
		"On-disk path relative to the repository root.",
		"stale artifact description",
	);
	assert.notEqual(stale, source);
	assert.equal(await renderOpenapi(stale), source);
});

test("generation refuses a missing generated component", async () => {
	const source = readFileSync(
		new URL("../openapi.yaml", import.meta.url),
		"utf8",
	);
	await assert.rejects(
		() =>
			renderOpenapi(
				source.replace(
					"    AtlasReleaseArtifactRef:\n",
					"    OldArtifactRef:\n",
				),
			),
		/Missing schema: AtlasReleaseArtifactRef/,
	);
});

test("schema generation does not replace a component with the same name in responses", async () => {
	const source = readFileSync(
		new URL("../openapi.yaml", import.meta.url),
		"utf8",
	);
	const otherComponent =
		"    AtlasReleaseArtifactRef:\n      description: A response with the same name.\n";
	const modified = source.replace(
		"\n  responses:\n",
		`\n  responses:\n${otherComponent}`,
	);
	assert.notEqual(modified, source);
	const rendered = await renderOpenapi(modified);
	assert.equal(rendered, modified);
});

test("generation repairs a stale catalogue operation", async () => {
	const source = readFileSync(
		new URL("../openapi.yaml", import.meta.url),
		"utf8",
	);
	const stale = source.replace(
		"summary: List published source datasets and their lineage",
		"summary: stale datasets",
	);
	assert.notEqual(stale, source);
	assert.equal(await renderOpenapi(stale), source);
});

test("catalogue examples satisfy their generated public schemas", () => {
	for (const path of [
		"/datasets",
		"/datasets/{dataset-id}",
		"/measures",
		"/measures/{measure-id}",
	]) {
		const media =
			document.paths[path].get.responses[200].content["application/json"];
		assert.deepEqual(
			schemaViolations(document, media.schema, media.example),
			[],
			path,
		);
		const invalid = structuredClone(media.example);
		const entry = Array.isArray(invalid.data)
			? invalid.data[0]
			: invalid.data;
		entry.id = 123;
		assert.ok(
			schemaViolations(document, media.schema, invalid).some((error) =>
				error.includes(".id"),
			),
			path,
		);
	}
});

test("geography listing examples satisfy their generated public schemas", () => {
	for (const path of ["/boundaries", "/boundary-releases"]) {
		const media =
			document.paths[path].get.responses[200].content["application/json"];
		assert.deepEqual(
			schemaViolations(document, media.schema, media.example),
			[],
			path,
		);
		const invalid = structuredClone(media.example);
		invalid.data[0].id = 123;
		assert.ok(
			schemaViolations(document, media.schema, invalid).some((error) =>
				error.includes(".id"),
			),
			path,
		);
	}
});

test("boundary release detail documents each download state", () => {
	const media =
		document.paths["/boundary-releases/{geography}/{release}"].get
			.responses[200].content["application/json"];
	for (const downloads of [
		{
			status: "available",
			mapResource: "/map",
			pmtiles: "/tiles",
			tileJson: "/tiles.json",
			geojson: { low: "/low" },
			geoparquet: { full: "/full" },
		},
		{
			status: "untiled",
			reason: "No tiles",
			geoparquet: { full: "/full" },
		},
		{ status: "unavailable", reason: "No geometry" },
	]) {
		const example = structuredClone(media.example);
		example.data.downloads = downloads;
		assert.deepEqual(schemaViolations(document, media.schema, example), []);
	}
	const invalid = structuredClone(media.example);
	invalid.data.downloads = { status: "available" };
	assert.notDeepEqual(schemaViolations(document, media.schema, invalid), []);
});

test("schema checks validate property names", () => {
	const schema = {
		type: "object",
		propertyNames: { pattern: "^[a-z]+$" },
		additionalProperties: { type: "string" },
	};
	assert.deepEqual(schemaViolations(document, schema, { good: "value" }), []);
	assert.notDeepEqual(
		schemaViolations(document, schema, { bad1: "value" }),
		[],
	);
});

test("the boundary detail schema describes a real response and its document links", () => {
	const response = route(
		"GET",
		"/v1/boundary-releases/ward/2025-01-en-ward",
		testContext(),
	);
	assert.equal(response.status, 200);
	const schema =
		document.paths["/boundary-releases/{geography}/{release}"].get
			.responses[200].content["application/json"].schema;
	assert.deepEqual(schemaViolations(document, schema, response.body), []);
	const example = structuredClone(response.body) as {
		data: { documents?: unknown };
	};
	delete example.data.documents;
	assert.ok(
		schemaViolations(document, schema, example).some((error) =>
			error.includes("documents"),
		),
	);
});

test("boundary selection example satisfies its generated schema", () => {
	const media =
		document.paths["/boundary-releases:resolve"].get.responses[200].content[
			"application/json"
		];
	assert.deepEqual(
		schemaViolations(document, media.schema, media.example),
		[],
	);
	const invalid = structuredClone(media.example);
	delete invalid.data.selected;
	assert.ok(
		schemaViolations(document, media.schema, invalid).some((error) =>
			error.includes("selected"),
		),
	);
});
