import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PROBLEM_CODES } from "../src/problemCodes";
import { route } from "../src/routes";
import { readApiCatalogues } from "../src/server";

/**
 * The API index, the OpenAPI paths and the README's endpoint list are three
 * descriptions of one set of routes. `openapi.test.ts` checks the first two
 * agree; this checks the routes behind them are really served, against the
 * compiled catalogues the server loads, and that the README agrees too.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogues = readApiCatalogues(apiRoot);

// The router's answer when no route matches a path at all. Any other
// response, a resource-specific 404 or a 400 included, shows a route exists.
const UNROUTED = "No API resource matches that path.";
const isUnrouted = (url: string) => {
	const response = route("GET", url, catalogues);
	return (
		response.status === 404 &&
		(response.body as { detail?: string }).detail === UNROUTED
	);
};

const indexLinks = (
	route("GET", "/v1", catalogues).body as { data: { links: string[] } }
).data.links;

/** A path template such as `/v1/areas/{type}` as a pattern for concrete paths. */
const templatePattern = (template: string) =>
	new RegExp(
		`^${template
			.replace(/[.*+?^$()|[\]\\]/g, "\\$&")
			.replace(/\{[^}]+\}/g, "[^/]+")}$`,
	);

const readme = readFileSync(resolve(apiRoot, "README.md"), "utf8");
const listed = [...readme.matchAll(/^- `GET (\/v1[^`]*)`$/gm)].map(
	(match) => match[1]!,
);

test("serves every route the API index advertises", () => {
	const unrouted = indexLinks.filter((link) =>
		isUnrouted(link.replace(/\{[^}]+\}/g, "placeholder")),
	);
	assert.deepEqual(unrouted, []);
});

test("lists every advertised route in the README, and nothing else", () => {
	const listedPaths = listed.map((url) => url.split("?")[0]!);
	assert.deepEqual(
		indexLinks.filter((link) => {
			const pattern = templatePattern(link);
			return !listedPaths.some(
				(path) => path === link || pattern.test(path),
			);
		}),
		[],
		"advertised routes missing from the README endpoint list",
	);
	const patterns = ["/v1", ...indexLinks].map(templatePattern);
	assert.deepEqual(
		listedPaths.filter(
			(path) =>
				!patterns.some((pattern) =>
					pattern.test(path.replace(/\{[^}]+\}/g, "placeholder")),
				),
		),
		[],
		"README endpoints the API index does not advertise",
	);
});

test("answers every concrete README example successfully", () => {
	const failing = listed
		.filter((url) => !url.includes("{"))
		.flatMap((url) => {
			const response = route("GET", url, catalogues);
			return response.status === 200
				? []
				: [
						`${response.status} ${url}: ${(response.body as { detail?: string }).detail}`,
					];
		});
	assert.deepEqual(failing, []);
});

test("produces every documented problem code from its example request", () => {
	for (const [code, definition] of Object.entries(PROBLEM_CODES)) {
		const response = route("GET", definition.example, catalogues);
		const body = response.body as Record<string, unknown>;
		assert.ok(
			(definition.statuses as readonly number[]).includes(
				response.status,
			),
			`${code}: ${definition.example} returned ${response.status}`,
		);
		assert.equal(body.code, code, definition.example);
		for (const member of definition.members) {
			assert.ok(member in body, `${code} lacks ${member}`);
		}
	}
});

test("gives every problem code a typed schema in the OpenAPI document", () => {
	const spec = readFileSync(resolve(apiRoot, "openapi.yaml"), "utf8");
	const problem = /^ {4}Problem:\n(?:(?! {4}\S).*\n)*/m.exec(spec)?.[0] ?? "";
	const enumerated =
		/^ {8}code:\n {10}type: string\n {10}enum:\n((?: {12}- \S+\n)+)/m
			.exec(problem)?.[1]
			?.trim()
			.split("\n")
			.map((line) => line.replace(/^\s*- /, ""));
	assert.deepEqual(
		[...(enumerated ?? [])].sort(),
		Object.keys(PROBLEM_CODES).sort(),
	);
	for (const [code, definition] of Object.entries(PROBLEM_CODES)) {
		const name = `${code
			.split("_")
			.map((word) => word[0]!.toUpperCase() + word.slice(1))
			.join("")}Problem`;
		const schema =
			new RegExp(`^ {4}${name}:\\n(?:(?! {4}\\S).*\\n)*`, "m").exec(
				spec,
			)?.[0] ?? "";
		assert.ok(schema, `no ${name} schema`);
		assert.match(schema, new RegExp(`const: ${code}\\n`));
		assert.match(
			schema,
			new RegExp(
				`required: \\[${["code", ...definition.members].join(", ")}\\]`,
			),
		);
		assert.match(
			schema,
			new RegExp(`enum: \\[${definition.statuses.join(", ")}\\]`),
		);
	}
});
