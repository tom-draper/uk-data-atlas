import assert from "node:assert/strict";
import test from "node:test";
import { schemaViolations, type SchemaDocument } from "./openapiSchema";

const document: SchemaDocument = {
	components: {
		schemas: {
			Area: {
				type: "object",
				required: ["code"],
				properties: { code: { type: "string", pattern: "^E" } },
			},
			Status: { enum: ["available", "unsupported"] },
		},
	},
};

test("accepts a value its schema describes", () => {
	assert.deepEqual(
		schemaViolations(
			document,
			{
				type: "object",
				required: ["areas", "status"],
				properties: {
					areas: {
						type: "array",
						maxItems: 2,
						items: { $ref: "#/components/schemas/Area" },
					},
					status: { $ref: "#/components/schemas/Status" },
					count: { type: "integer", minimum: 0 },
					next: { type: ["string", "null"] },
				},
			},
			{
				areas: [{ code: "E1", extra: true }],
				status: "available",
				count: 3,
				next: null,
			},
		),
		[],
	);
});

test("names where a value departs from its schema", () => {
	assert.deepEqual(
		schemaViolations(
			document,
			{
				type: "object",
				required: ["areas", "status"],
				properties: {
					areas: {
						type: "array",
						items: { $ref: "#/components/schemas/Area" },
					},
					status: { $ref: "#/components/schemas/Status" },
					count: { type: "integer" },
				},
			},
			{ areas: [{ code: "W1" }, {}], count: 1.5 },
		),
		[
			".status: required but absent",
			'.areas[0].code: "W1" does not match ^E',
			".areas[1].code: required but absent",
			".count: expected integer, got number 1.5",
		],
	);
});

test("requires exactly one oneOf branch and at least one anyOf branch", () => {
	const branches = [{ type: "number" }, { type: "integer" }];
	assert.deepEqual(schemaViolations(document, { oneOf: branches }, 1.5), []);
	assert.deepEqual(schemaViolations(document, { oneOf: branches }, 1), [
		"(root): matches 2 oneOf branches",
	]);
	assert.deepEqual(schemaViolations(document, { anyOf: branches }, 1), []);
	assert.match(
		schemaViolations(document, { anyOf: branches }, "1")[0]!,
		/matches no anyOf branch/,
	);
});

test("reports a keyword it does not check rather than passing it", () => {
	assert.deepEqual(schemaViolations(document, { maxLength: 2 }, "abc"), [
		"(root): unchecked keyword maxLength",
	]);
});
