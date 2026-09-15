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

const segmentsFor = (path: string) =>
	`/v1${path}`
		.replaceAll(/\{[^}]+\}/g, "placeholder")
		.split("/")
		.filter(Boolean);

test("no documented path is claimed by more than one route family", () => {
	assert.ok(documentedPaths.length > 0);
	const contested = documentedPaths.flatMap((path) => {
		const families = routeFamiliesOwning(segmentsFor(path));
		return families.length > 1 ? [`${path}: ${families.join(", ")}`] : [];
	});
	assert.deepEqual(contested, []);
});
