import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";
import { compileOperations } from "../scripts/build-operations";
import {
	compileOperationTemplates,
	createOperationMatcher,
	deprecationHeaders,
	openapiDocumentHash,
	unexpectedQueryParameter,
} from "../src/operationTemplates";

const openapiDocument = readFileSync(
	new URL("../openapi.yaml", import.meta.url),
	"utf8",
);
const templates = compileOperations(openapiDocument).operations;
const readOperationTemplates = (yaml: string) =>
	compileOperationTemplates(parse(yaml));
const match = createOperationMatcher(templates);

test("labels a request by the operation it reached", () => {
	for (const [path, route] of [
		["/v1", "/v1"],
		[
			"/v1/areas/ward/2023-05-uk-bgc/E05000001",
			"/v1/areas/{geography}/{release}/{code}",
		],
		[
			"/v1/areas/ward/2023-05-uk-bgc/E05000001/history",
			"/v1/areas/{geography}/{release}/{code}/history",
		],
		["/v1/places", "/v1/places"],
		["/v1/areas:contains", "/v1/areas:contains"],
		["/v1/boundary-releases:resolve", "/v1/boundary-releases:resolve"],
		[
			"/v1/map-resources/localAuthority/2023-05-uk-bgc-v2.pmtiles",
			"/v1/map-resources/{geography}/{release}.pmtiles",
		],
		[
			"/v1/map-resources/localAuthority/2023-05-uk-bgc-v2/tiles/3/4/2.mvt",
			"/v1/map-resources/{geography}/{release}/tiles/{z}/{x}/{y}.mvt",
		],
		["/v1/nothing/here", "unmatched"],
		["/v2/areas", "unmatched"],
		["/", "unmatched"],
	] as const) {
		assert.equal(match(path).route, route, path);
	}
});

test("announces a deprecated operation on every response it serves", () => {
	const [deprecated] = readOperationTemplates(
		[
			"openapi: 3.1.0",
			"paths:",
			"  /old:",
			"    get:",
			"      operationId: getOld",
			"      deprecated: true",
			'      x-deprecated-since: "2026-01-01"',
			'      x-sunset: "2027-01-01"',
			"components:",
			"  schemas: {}",
		].join("\n"),
	);
	assert.deepEqual(deprecated, {
		path: "/old",
		queryParameters: { get: [] },
		deprecation: { since: "2026-01-01", sunset: "2027-01-01" },
	});
	assert.deepEqual(deprecationHeaders(deprecated), {
		deprecation: "@1767225600",
		sunset: "Fri, 01 Jan 2027 00:00:00 GMT",
	});
	assert.deepEqual(deprecationHeaders(templates[0]), {});
});

test("prices an operation by its declared cost, the dearer of two on one path", () => {
	const [cheap, dear] = readOperationTemplates(
		[
			"openapi: 3.1.0",
			"paths:",
			"  /cheap:",
			"    get:",
			"      operationId: getCheap",
			"  /areas:validate:",
			"    get:",
			"      operationId: validate",
			"      x-rate-limit-cost: 5",
			"    post:",
			"      operationId: validatePosted",
			"      x-rate-limit-cost: 10",
		].join("\n"),
	);
	assert.equal(cheap!.cost, undefined);
	assert.equal(dear!.cost, 10);
});

test("reads a query parameter however its YAML is written", () => {
	const [operation] = readOperationTemplates(
		[
			"openapi: 3.1.0",
			"paths:",
			"    /styles:",
			"        parameters:",
			"            - name: shared",
			"              in: query",
			"        get:",
			"            parameters:",
			"            -   name: block",
			"                in: query",
			"            - { in: query, name: flowInFirst }",
			"            - {",
			"                name: flowOverLines,",
			"                in: query",
			"              }",
			'            - $ref: "#/components/parameters/Referenced"',
			"            - { name: segment, in: path, required: true }",
			"            x-refused-query-parameters:",
			"              - release",
			"components:",
			"    parameters:",
			"        Referenced: { name: referenced, in: query }",
		].join("\n"),
	);
	assert.deepEqual(operation, {
		path: "/styles",
		queryParameters: {
			get: [
				"shared",
				"block",
				"flowInFirst",
				"flowOverLines",
				"referenced",
			],
		},
		refusedQueryParameters: { get: ["release"] },
	});
});

test("records the document it compiled the operations from", () => {
	assert.equal(
		compileOperations(openapiDocument).inputs.openapiDocument,
		openapiDocumentHash(openapiDocument),
	);
});

test("leaves a parameter an operation refuses with its reason to the operation", () => {
	const series = match("/v1/data/population/series").operation;
	assert.equal(
		unexpectedQueryParameter(
			series,
			"GET",
			"/v1/data/population/series?place=E08000003&release=2023-05-uk-bgc",
		),
		undefined,
	);
	assert.equal(
		unexpectedQueryParameter(
			series,
			"GET",
			"/v1/data/population/series?place=E08000003&relase=2023-05-uk-bgc",
		)?.parameter,
		"relase",
	);
});
