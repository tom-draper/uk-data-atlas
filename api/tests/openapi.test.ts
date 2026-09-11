import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { route } from "../src/routes";
import type { BoundaryRegistry } from "../src/boundaryRegistry";

// There is no YAML parser in this package, so read what these tests need by
// line: path keys sit at a two-space indent under `paths:`, component names
// at a four-space indent under each `components:` section, and every
// operation declares `operationId:` on its own line.
const spec = readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8");
const lines = spec.split("\n");

const sectionLines = (section: string) => {
	const start = lines.indexOf(`${section}:`);
	assert.notEqual(start, -1, `openapi.yaml has no top-level ${section}`);
	const end = lines.findIndex(
		(line, index) => index > start && /^\S/.test(line),
	);
	return lines.slice(start + 1, end === -1 ? undefined : end);
};

const specPaths = () =>
	sectionLines("paths").flatMap((line) => {
		const match = /^ {2}(\/\S*):\s*$/.exec(line);
		return match ? [match[1]] : [];
	});

const componentNames = () => {
	let group = "";
	return sectionLines("components").flatMap((line) => {
		const groupMatch = /^ {2}(\w+):\s*$/.exec(line);
		if (groupMatch) group = groupMatch[1];
		const match = /^ {4}(\w+):\s*$/.exec(line);
		return match ? [`${group}/${match[1]}`] : [];
	});
};

const componentRefs = () =>
	lines.flatMap((line) => {
		const match = /\$ref:\s*"#\/components\/(\w+\/\w+)"/.exec(line);
		return match ? [match[1]] : [];
	});

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

test("declares each path, component and operationId only once", () => {
	assert.deepEqual(duplicates(specPaths()), []);
	assert.deepEqual(duplicates(componentNames()), []);
	assert.deepEqual(duplicates(operationIds()), []);
});

test("resolves every component reference", () => {
	const names = new Set(componentNames());
	assert.deepEqual(
		[...new Set(componentRefs())].filter((ref) => !names.has(ref)),
		[],
	);
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
