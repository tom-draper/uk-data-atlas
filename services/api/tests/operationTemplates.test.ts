import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse } from "yaml";
import {
	createOperationMatcher,
	deprecationHeaders,
	readOperationTemplates,
	unexpectedQueryParameter,
} from "../src/operationTemplates";

const templates = readOperationTemplates(
	readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8"),
);
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

test("reads every operation's query parameters as a YAML parser does", () => {
	type Parameter = { $ref?: string; name?: string; in?: string };
	type Operation = { parameters?: Parameter[] };
	const document = parse(
		readFileSync(new URL("../openapi.yaml", import.meta.url), "utf8"),
	) as {
		paths: Record<string, Partial<Record<"get" | "post", Operation>>>;
		components: { parameters: Record<string, Parameter> };
	};
	const resolved = (parameter: Parameter) =>
		parameter.$ref
			? document.components.parameters[parameter.$ref.split("/").at(-1)!]!
			: parameter;
	for (const [path, item] of Object.entries(document.paths))
		for (const method of ["get", "post"] as const) {
			const operation = item[method];
			if (!operation) continue;
			const declared = (operation.parameters ?? [])
				.map(resolved)
				.filter((parameter) => parameter.in === "query")
				.map((parameter) => parameter.name)
				.sort();
			assert.deepEqual(
				[
					...(templates.find((template) => template.path === path)
						?.queryParameters[method] ?? []),
				].sort(),
				declared,
				`${method} ${path}`,
			);
		}
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
