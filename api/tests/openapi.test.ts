import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";
import { route } from "../src/routes";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import { testContext } from "./routeFixtures";

type OpenApiOperation = { operationId?: string; tags?: string[] };
type OpenApiPathItem = Partial<
	Record<
		| "get"
		| "put"
		| "post"
		| "delete"
		| "options"
		| "head"
		| "patch"
		| "trace",
		OpenApiOperation
	>
>;
type OpenApiDocument = {
	paths: Record<string, OpenApiPathItem>;
	components: Record<string, Record<string, unknown>>;
	tags: Array<{ name: string }>;
};

const source = readFileSync(
	new URL("../openapi.yaml", import.meta.url),
	"utf8",
);
const spec = parse(source) as OpenApiDocument;
const specPaths = Object.keys(spec.paths);
const componentNames = Object.entries(spec.components).flatMap(
	([group, components]) =>
		Object.keys(components).map((name) => `${group}/${name}`),
);
const componentRefs = (value: unknown): string[] => {
	if (Array.isArray(value)) return value.flatMap(componentRefs);
	if (typeof value !== "object" || value === null) return [];
	return Object.entries(value).flatMap(([key, child]) => {
		if (key === "$ref" && typeof child === "string") {
			const match = /^#\/components\/([^/]+)\/([^/]+)$/.exec(child);
			return match ? [`${match[1]}/${match[2]}`] : [];
		}
		return componentRefs(child);
	});
};
const httpMethods = [
	"get",
	"put",
	"post",
	"delete",
	"options",
	"head",
	"patch",
	"trace",
] as const;
const operations = Object.values(spec.paths).flatMap((pathItem) =>
	httpMethods.flatMap((method) =>
		pathItem[method] ? [pathItem[method]] : [],
	),
);

const duplicates = (values: string[]) => [
	...new Set(
		values.filter((value, index) => values.indexOf(value) !== index),
	),
];

const registry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [],
};

test("declares each path, component and operationId only once", () => {
	assert.ok(specPaths.length > 0, "openapi.yaml has no paths");
	assert.ok(componentNames.length > 0, "openapi.yaml has no components");
	assert.deepEqual(duplicates(specPaths), []);
	assert.deepEqual(duplicates(componentNames), []);
	const operationIds = operations.flatMap((operation) =>
		operation.operationId ? [operation.operationId] : [],
	);
	assert.equal(
		operationIds.length,
		operations.length,
		"every OpenAPI operation must declare an operationId",
	);
	assert.deepEqual(duplicates(operationIds), []);
});

test("resolves every component reference", () => {
	const names = new Set(componentNames);
	assert.deepEqual(
		[...new Set(componentRefs(spec))].filter((ref) => !names.has(ref)),
		[],
	);
});

test("documents exactly the routes advertised by the API index", () => {
	const response = route(
		"GET",
		"/v1",
		testContext({ boundaryRegistry: registry }),
	);
	assert.equal(response.status, 200);
	const { links } = (response.body as { data: { links: string[] } }).data;
	// Placeholders are compared by name too, so the index and the spec
	// cannot drift into two vocabularies for the same path.
	const advertised = ["/v1", ...links].sort();
	const documented = specPaths
		.map((path) => (path === "/" ? "/v1" : `/v1${path}`))
		.sort();
	assert.deepEqual(documented, advertised);
});

test("files every operation under exactly one declared task tag", () => {
	const declared = spec.tags.map(({ name }) => name);
	assert.deepEqual(declared, [
		"Start here",
		"Map",
		"Trend",
		"Sync",
		"Geography",
		"Terrain",
		"Data catalogue",
		"Governance",
	]);
	const untagged: string[] = [];
	const used = new Set<string>();
	for (const operation of operations) {
		const tags = operation.tags ?? [];
		if (
			!operation.operationId ||
			tags.length !== 1 ||
			!declared.includes(tags[0]!)
		) {
			untagged.push(operation.operationId ?? "<missing operationId>");
		} else {
			used.add(tags[0]!);
		}
	}
	assert.deepEqual(untagged, []);
	assert.deepEqual(
		declared.filter((tag) => !used.has(tag)),
		[],
		"declared tags no operation uses",
	);
});
