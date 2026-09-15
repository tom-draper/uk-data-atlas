import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { routeFamiliesOwning } from "../src/routeHandlers";

// Path keys sit at a two-space indent under `paths:` in openapi.yaml.
const documentedPaths = readFileSync(
	new URL("../openapi.yaml", import.meta.url),
	"utf8",
)
	.split("\n")
	.flatMap((line) => {
		const match = /^ {2}(\/\S*):\s*$/.exec(line);
		return match ? [match[1]!] : [];
	});

// The spec writes the index as `/` and every other path relative to `/v1`.
const segmentsFor = (path: string) =>
	(path === "/" ? "/v1" : `/v1${path}`)
		.replaceAll(/\{[^}]+\}/g, "placeholder")
		.split("/")
		.filter(Boolean);

test("every documented path is owned by exactly one route family", () => {
	assert.ok(documentedPaths.length > 0);
	const misowned = documentedPaths.flatMap((path) => {
		const families = routeFamiliesOwning(segmentsFor(path));
		return families.length === 1
			? []
			: [`${path}: ${families.join(", ") || "no family"}`];
	});
	assert.deepEqual(misowned, []);
});
