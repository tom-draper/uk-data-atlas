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
	const response = route("GET", "/v1", { boundaryRegistry: registry });
	assert.equal(response.status, 200);
	const { links } = (response.body as { data: { links: string[] } }).data;
	// Placeholders are compared by name too, so the index and the spec
	// cannot drift into two vocabularies for the same path.
	const advertised = ["/v1", ...links].sort();
	const documented = specPaths()
		.map((path) => (path === "/" ? "/v1" : `/v1${path}`))
		.sort();
	assert.deepEqual(documented, advertised);
});

test("files every operation under exactly one declared task tag", () => {
	const declared = sectionLines("tags").flatMap((line) => {
		const match = /^ {2}- name: "([^"]+)"$/.exec(line);
		return match ? [match[1]!] : [];
	});
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
	// Each operation's tags sit on the line after its operationId.
	const untagged: string[] = [];
	const used = new Set<string>();
	lines.forEach((line, index) => {
		const operation = /^\s+operationId:\s*(\S+)\s*$/.exec(line)?.[1];
		if (!operation) return;
		const tags = /^\s+tags: \["([^"]+)"\]$/.exec(lines[index + 1] ?? "");
		if (!tags || !declared.includes(tags[1]!)) untagged.push(operation);
		else used.add(tags[1]!);
	});
	assert.deepEqual(untagged, []);
	assert.deepEqual(
		declared.filter((tag) => !used.has(tag)),
		[],
		"declared tags no operation uses",
	);
});
