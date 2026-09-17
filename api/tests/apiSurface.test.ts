import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
	currentSurface,
	renderSurface,
	surfacePath,
} from "../scripts/build-api-surface";
import { breakingChanges, type ApiSurface } from "../src/apiSurface";

const today = new Date().toISOString().slice(0, 10);
const locked = JSON.parse(readFileSync(surfacePath, "utf8")) as ApiSurface;

test("keeps every v1 promise the locked surface makes", () => {
	assert.deepEqual(breakingChanges(locked, currentSurface(), today), []);
});

test("locks every addition, so each one is reviewed as a promise", () => {
	assert.equal(
		renderSurface(currentSurface()),
		readFileSync(surfacePath, "utf8"),
		"openapi.yaml has grown past the locked surface; run `pnpm contract:surface` and commit contract/v1-surface.json.",
	);
});

const base: ApiSurface = {
	schemaVersion: 1,
	apiVersion: "v1",
	operations: {
		"GET /things": {
			operationId: "listThings",
			parameters: {
				"query:limit": { required: false, minimum: 1, maximum: 500 },
				"query:format": { required: false, enum: ["csv", "json"] },
				"query:q": { required: false },
			},
			responses: {
				"200 application/json": ["data", "data[].id", "data[].name"],
				"404 application/problem+json": ["code"],
			},
		},
	},
};

const changed = (
	edit: (operation: ApiSurface["operations"][string]) => void,
): ApiSurface => {
	const copy = structuredClone(base);
	edit(copy.operations["GET /things"]!);
	return copy;
};

test("refuses each kind of change that breaks an existing client", () => {
	const cases: Array<[string, ApiSurface, RegExp]> = [
		[
			"removal",
			{ ...base, operations: {} },
			/removed without first being deprecated/,
		],
		[
			"parameter removed",
			changed((op) => delete op.parameters["query:q"]),
			/no longer accepts query:q/,
		],
		[
			"now required",
			changed((op) => (op.parameters["query:q"]!.required = true)),
			/now requires query:q/,
		],
		[
			"required added",
			changed((op) => (op.parameters["query:area"] = { required: true })),
			/added the required parameter query:area/,
		],
		[
			"enum narrowed",
			changed((op) => (op.parameters["query:format"]!.enum = ["json"])),
			/no longer accepts query:format = csv/,
		],
		[
			"enum imposed",
			changed((op) => (op.parameters["query:q"]!.enum = ["a"])),
			/now restricts query:q/,
		],
		[
			"maximum lowered",
			changed((op) => (op.parameters["query:limit"]!.maximum = 100)),
			/lowered the maximum of query:limit/,
		],
		[
			"minimum raised",
			changed((op) => (op.parameters["query:limit"]!.minimum = 10)),
			/raised the minimum of query:limit/,
		],
		[
			"property removed",
			changed(
				(op) =>
					(op.responses["200 application/json"] = [
						"data",
						"data[].id",
					]),
			),
			/no longer has data\[\]\.name/,
		],
		[
			"status removed",
			changed(
				(op) => delete op.responses["404 application/problem+json"],
			),
			/no longer answers 404/,
		],
		[
			"undated deprecation",
			changed(
				(op) =>
					(op.deprecated = {
						since: "undefined",
						sunset: "undefined",
					}),
			),
			/deprecated without x-deprecated-since/,
		],
	];
	for (const [name, current, message] of cases) {
		const breaks = breakingChanges(base, current, today);
		assert.equal(breaks.length, 1, `${name}: ${breaks.join(" | ")}`);
		assert.match(breaks[0]!, message, name);
	}
});

test("allows additions, and a removal only after its sunset", () => {
	const grown = changed((op) => {
		op.parameters["query:sort"] = { required: false };
		op.parameters["query:format"]!.enum = ["csv", "json", "ndjson"];
		op.parameters["query:limit"]!.maximum = 1000;
		op.responses["200 application/json"]!.push("data[].href");
		op.responses["400 application/problem+json"] = ["code"];
	});
	assert.deepEqual(breakingChanges(base, grown, today), []);

	const deprecated = changed((op) => {
		op.deprecated = { since: "2026-01-01", sunset: "2027-01-01" };
	});
	const removed = { ...base, operations: {} };
	assert.deepEqual(breakingChanges(deprecated, removed, "2026-12-31"), [
		"GET /things was removed before its sunset on 2027-01-01.",
	]);
	assert.deepEqual(breakingChanges(deprecated, removed, "2027-01-01"), []);
});
