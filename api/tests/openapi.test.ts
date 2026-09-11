import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { route } from "../src/routes";
import type { BoundaryRegistry } from "../src/boundaryRegistry";

// There is no YAML parser in this package, so read the two things these tests
// need by line: path keys sit at a two-space indent under `paths:`, and every
// operation declares `operationId:` on its own line.
const spec = readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8");
const lines = spec.split("\n");

const specPaths = () => {
	const start = lines.indexOf("paths:");
	assert.notEqual(start, -1, "openapi.yaml has no top-level paths section");
	const paths: string[] = [];
	for (const line of lines.slice(start + 1)) {
		if (/^\S/.test(line)) break;
		const match = /^ {2}(\/\S*):\s*$/.exec(line);
		if (match) paths.push(match[1]);
	}
	return paths;
};

const operationIds = () =>
	lines.flatMap((line) => {
		const match = /^\s+operationId:\s*(\S+)\s*$/.exec(line);
		return match ? [match[1]] : [];
	});

const duplicates = (values: string[]) => [
	...new Set(
		values.filter((value, index) => values.indexOf(value) !== index),
	),
];

// Parameter names differ between the spec ({geography}) and the index
// ({type}), and are not part of the route shape.
const routeShape = (path: string) => path.replaceAll(/\{[^}]+\}/g, "{}");

const registry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [],
};

test("declares each path and operationId only once", () => {
	assert.deepEqual(duplicates(specPaths()), []);
	assert.deepEqual(duplicates(operationIds()), []);
});

test("documents exactly the routes advertised by the API index", () => {
	const response = route("GET", "/v1", registry);
	assert.equal(response.status, 200);
	const { links } = (response.body as { data: { links: string[] } }).data;
	const advertised = ["/v1", ...links].map(routeShape).sort();
	const documented = specPaths()
		.map((path) => routeShape(path === "/" ? "/v1" : `/v1${path}`))
		.sort();
	assert.deepEqual(documented, advertised);
});
