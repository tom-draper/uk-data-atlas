import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";
import {
	choices,
	readChoice,
	readWholeNumber,
} from "@uk-data-atlas/atlas-runtime/api";
import { compileQueryRules } from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "../src/queryRules";

const openapiDocument = readFileSync(
	new URL("../openapi.yaml", import.meta.url),
	"utf8",
);

test("the committed query rules are the ones openapi.yaml states", () => {
	assert.deepEqual(
		QUERY_RULES,
		compileQueryRules(parse(openapiDocument)),
		"Run pnpm --dir services/api generate:query-rules.",
	);
});

test("compiles an enum and a bounded integer, and nothing else", () => {
	assert.deepEqual(
		compileQueryRules({
			paths: {
				"/things": {
					parameters: [
						{ $ref: "#/components/parameters/Limit" },
						{
							name: "tier",
							in: "query",
							schema: { type: "string" },
						},
					],
					get: {
						parameters: [
							{
								name: "format",
								in: "query",
								schema: { $ref: "#/components/schemas/Format" },
							},
							{
								name: "q",
								in: "query",
								schema: { type: "string" },
							},
							{ name: "id", in: "path", schema: { enum: ["a"] } },
							{
								name: "offset",
								in: "query",
								schema: { type: "integer", minimum: 0 },
							},
						],
					},
					post: {
						parameters: [
							{
								name: "tier",
								in: "query",
								schema: { enum: ["low", "high"] },
							},
						],
					},
				},
			},
			components: {
				parameters: {
					Limit: {
						name: "limit",
						in: "query",
						schema: {
							type: "integer",
							minimum: 1,
							maximum: 50,
							default: 10,
						},
					},
				},
				schemas: { Format: { enum: ["json", "csv"], default: "json" } },
			},
		}),
		{
			"GET /things": {
				limit: { minimum: 1, maximum: 50, default: 10 },
				format: { values: ["json", "csv"], default: "json" },
			},
			"POST /things": {
				limit: { minimum: 1, maximum: 50, default: 10 },
				tier: { values: ["low", "high"] },
			},
		},
	);
});

test("refuses a reference the document does not define", () => {
	assert.throws(
		() =>
			compileQueryRules({
				paths: {
					"/things": {
						get: {
							parameters: [
								{ $ref: "#/components/parameters/Missing" },
							],
						},
					},
				},
			}),
		/Unresolved reference/,
	);
});

test("reads a choice as its value, its default, or null when refused", () => {
	const format = { values: ["json", "csv"], default: "json" } as const;
	const tier = { values: ["low", "high"] } as const;
	assert.equal(readChoice("csv", format), "csv");
	assert.equal(readChoice(null, format), "json");
	assert.equal(readChoice("xml", format), null);
	assert.equal(readChoice("", format), null);
	assert.equal(readChoice(null, tier), undefined);
	assert.equal(readChoice("LOW", tier), null);
});

test("reads a whole number as plain digits within the range", () => {
	const limit = { minimum: 1, maximum: 50, default: 10 } as const;
	const depth = { minimum: 1, maximum: 20 } as const;
	assert.equal(readWholeNumber("50", limit), 50);
	assert.equal(readWholeNumber(null, limit), 10);
	assert.equal(readWholeNumber(null, depth), undefined);
	for (const refused of ["0", "51", "1.5", "+5", "-1", "1e1", " 5", ""])
		assert.equal(readWholeNumber(refused, limit), null, refused);
});

test("lists a rule's choices as a sentence does", () => {
	assert.equal(choices({ values: ["json"] }), "json");
	assert.equal(choices({ values: ["json", "csv"] }), "json or csv");
	assert.equal(
		choices({ values: ["json", "csv", "ndjson"] }),
		"json, csv or ndjson",
	);
});

test("operations that share a reader state the same rule", () => {
	const crs = QUERY_RULES["GET /areas:contains"].crs;
	for (const shared of [
		QUERY_RULES["POST /areas:containsBatch"].crs,
		QUERY_RULES["GET /areas:near"].crs,
		QUERY_RULES["GET /coordinates:convert"].crs,
		QUERY_RULES["GET /coordinates:convert"].to,
	])
		assert.deepEqual(shared, crs);
	assert.deepEqual(
		QUERY_RULES["POST /postcodes:batch"].view,
		QUERY_RULES["GET /postcodes/{postcode}"].view,
	);
	assert.deepEqual(
		QUERY_RULES["GET /areas/{geography}/{release}/{code}/children"].depth,
		QUERY_RULES["GET /areas/{geography}/{release}/{code}/parents"].depth,
	);
});
