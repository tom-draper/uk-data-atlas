import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { PROBLEM_CODES } from "../src/problemCodes";
import { route } from "../src/routes";
import { readApiCatalogues } from "../src/server";
import {
	INDEX_END,
	INDEX_START,
	renderRouteIndex,
} from "../scripts/build-readme-index";

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

/** A path template such as `/v1/areas/{geography}` as a pattern for concrete paths. */
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

test("resolves every README example to an advertised route", () => {
	const listedPaths = listed.map((url) => url.split("?")[0]!);
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

test("generates the README route index from the OpenAPI document", () => {
	const readmeIndex = readme.slice(
		readme.indexOf(INDEX_START),
		readme.indexOf(INDEX_END) + INDEX_END.length,
	);
	assert.equal(
		readmeIndex,
		renderRouteIndex(openapi),
		"the route index is stale; run `pnpm docs:index`",
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

type OpenApiExample = { value: unknown; "x-example-request"?: string };
type OpenApiMedia = {
	example?: unknown;
	examples?: Record<string, OpenApiExample>;
	"x-example-request"?: string;
};

// Parsed strictly, so a repeated key fails here rather than in a client's
// code generator.
const openapi = parse(
	readFileSync(resolve(apiRoot, "openapi.yaml"), "utf8"),
) as {
	tags: Array<{ name: string; description?: string }>;
	paths: Record<
		string,
		{
			get?: {
				tags?: string[];
				summary?: string;
				responses: Record<
					string,
					{ content?: Record<string, OpenApiMedia> }
				>;
			};
		}
	>;
	components: { schemas: Record<string, { examples?: unknown[] }> };
};

const responseExamples = Object.entries(openapi.paths).flatMap(
	([path, item]) => {
		const media = item.get?.responses["200"]?.content?.["application/json"];
		if (!media) return [];
		if (media.example !== undefined)
			return [
				{
					name: path,
					request: media["x-example-request"],
					value: media.example,
				},
			];
		return Object.entries(media.examples ?? {}).map(([name, example]) => ({
			name: `${path} ${name}`,
			request: example["x-example-request"],
			value: example.value,
		}));
	},
);

/**
 * Where an example departs from the live response. Examples are abridged, so
 * a live object may carry more members and an example array lists only some
 * of the live items, in any order. Identifiers, codes, names and prose must
 * match exactly. Hashes and numbers change with every data build, so only
 * their type is checked: an example shows what a count or hash looks like,
 * not today's value.
 */
const departures = (example: unknown, live: unknown, at: string): string[] => {
	if (typeof example === "string" && example.startsWith("sha256:"))
		return typeof live === "string" && live.startsWith("sha256:")
			? []
			: [`${at}: expected a hash`];
	if (typeof example === "number")
		return typeof live === "number" ? [] : [`${at}: expected a number`];
	if (example === null || typeof example !== "object")
		return example === live
			? []
			: [`${at}: ${JSON.stringify(example)} is ${JSON.stringify(live)}`];
	if (Array.isArray(example)) {
		if (!Array.isArray(live)) return [`${at}: expected an array`];
		if (example.length === 0)
			return live.length === 0 ? [] : [`${at}: expected an empty array`];
		return example.flatMap((item, index) => {
			const attempts = live.map((candidate) =>
				departures(item, candidate, `${at}[${index}]`),
			);
			if (attempts.some((attempt) => attempt.length === 0)) return [];
			const closest = attempts.sort(
				(left, right) => left.length - right.length,
			)[0];
			return closest ?? [`${at}[${index}]: no live item`];
		});
	}
	if (live === null || typeof live !== "object" || Array.isArray(live))
		return [`${at}: expected an object`];
	return Object.entries(example).flatMap(([key, value]) =>
		key in live
			? departures(
					value,
					(live as Record<string, unknown>)[key],
					`${at}.${key}`,
				)
			: [`${at}.${key}: not in the live response`],
	);
};

test("names the request behind every OpenAPI response example", () => {
	assert.ok(responseExamples.length > 0);
	assert.deepEqual(
		responseExamples
			.filter((example) => !example.request)
			.map((example) => example.name),
		[],
	);
});

test("matches every OpenAPI response example to the live response", () => {
	const drifted = responseExamples.flatMap(({ name, request, value }) => {
		if (!request) return [];
		const response = route("GET", request, catalogues);
		if (response.status !== 200)
			return [`${name}: ${request} returned ${response.status}`];
		return departures(value, response.body, "").map(
			(departure) => `${name}${departure}`,
		);
	});
	assert.deepEqual(drifted, []);
});

test("shows each problem code's live response as its OpenAPI example", () => {
	const drifted = Object.entries(PROBLEM_CODES).flatMap(
		([code, definition]) => {
			const name = `${code
				.split("_")
				.map((word) => word[0]!.toUpperCase() + word.slice(1))
				.join("")}Problem`;
			const [example] = openapi.components.schemas[name]?.examples ?? [];
			return departures(
				example,
				route("GET", definition.example, catalogues).body,
				"",
			).map((departure) => `${name}${departure}`);
		},
	);
	assert.deepEqual(drifted, []);
});

/** The routes that page with a cursor, and a query that fills each one. */
const PAGINATED = [
	"/v1/areas?geography=ward&release=2024-12-uk-bgc",
	"/v1/crosswalks/ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment/records",
	"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023",
	"/v1/data/population-estimate/convert?period=2022&geography=ward&boundaryYear=2023&crosswalk=ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment",
	"/v1/data/population-estimate/rankings?period=2022&geography=ward&boundaryYear=2023",
	"/v1/data/population-estimate/change?geography=localAuthority&boundaryYear=2023&startPeriod=2011&endPeriod=2022",
];

test("pages every cursor route the same way", () => {
	for (const path of PAGINATED) {
		const query = `${path}${path.includes("?") ? "&" : "?"}`;
		const first = route("GET", `${query}limit=1`, catalogues);
		assert.equal(first.status, 200, query);
		const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
		assert.equal(typeof cursor, "string", `${query} has no nextCursor`);
		const next = route(
			"GET",
			`${query}limit=1&cursor=${encodeURIComponent(cursor ?? "")}`,
			catalogues,
		);
		assert.equal(next.status, 200, query);
		assert.notDeepEqual(
			"data" in next.body && next.body.data,
			"data" in first.body && first.body.data,
			`${query} served the same page twice`,
		);
		// A cursor this API did not issue is refused, not ignored.
		const refused = route(
			"GET",
			`${query}&cursor=not-a-cursor`,
			catalogues,
		);
		assert.equal(refused.status, 400, query);
		assert.equal(
			"code" in refused.body && refused.body.code,
			"invalid_cursor",
			query,
		);
	}
});

test("serves each representation the OpenAPI document declares", () => {
	const mediaTypes = (path: string) =>
		Object.keys(
			openapi.paths[path]?.get?.responses["200"]?.content ?? {},
		).sort();
	const served = (url: string) => {
		const response = route("GET", url, catalogues);
		assert.equal(response.status, 200, url);
		return (
			response.representation?.contentType.split(";")[0] ??
			"application/json"
		);
	};
	const data =
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=1";
	assert.deepEqual(
		[
			served(data),
			served(`${data}&format=csv`),
			served(`${data}&format=ndjson`),
		].sort(),
		mediaTypes("/data/{measure-id}"),
	);
	const lookup = (
		route("GET", "/v1/lookups", catalogues).body as {
			data: { lookups: Array<{ id: string }> };
		}
	).data.lookups[0]?.id;
	assert.ok(lookup);
	assert.deepEqual(
		[
			served(`/v1/lookups/${lookup}`),
			served(`/v1/lookups/${lookup}?format=ndjson`),
		].sort(),
		mediaTypes("/lookups/{lookup-id}"),
	);
	// A tabular page that is not the last carries its successor, as the
	// document says, because a CSV body has nowhere to put a cursor.
	const page = route("GET", `${data}&format=csv`, catalogues);
	assert.match(
		page.representation?.headers?.link ?? "",
		/^<\/v1\/data\/population-estimate\?[^>]*cursor=[^>]+>; rel="next"$/,
	);
});

/** The derivative data routes, each with a query that reaches its work. */
const DERIVATIVE = [
	"/v1/data/population-estimate/series?areaCode=E05000932&geography=ward&boundaryYear=2023",
	"/v1/data/population-estimate/rankings?period=2022&geography=ward&boundaryYear=2023",
	"/v1/data/population-estimate/change?geography=localAuthority&boundaryYear=2023&startPeriod=2011&endPeriod=2022",
	"/v1/data/population-estimate/compare?period=2022&geography=ward&boundaryYear=2023&baselineAreaCode=E05000932&comparisonAreaCode=W05001039",
	"/v1/data/population-estimate/aggregate?period=2022&geography=ward&boundaryYear=2023&locationId=north-west",
	"/v1/data/population-estimate/convert?period=2022&geography=ward&boundaryYear=2023&crosswalk=ward-2023-05-uk-bgc-to-local-authority-2023-05-uk-bgc-v2-clean-containment",
];

test("keeps a geometry release from standing in for a conversion", () => {
	const base =
		"/v1/data/population-estimate?period=2022&geography=ward&boundaryYear=2023&limit=3";
	const sourceExact = route("GET", base, catalogues);
	const joined = route("GET", `${base}&release=2023-05-uk-bgc`, catalogues);
	const records = (response: typeof sourceExact) =>
		"data" in response.body
			? (response.body.data as { records: unknown }).records
			: undefined;
	// The release chooses geometry to draw the values on. It is not a
	// conversion, so every value stays exactly what the publisher observed.
	assert.deepEqual(records(joined), records(sourceExact));
	const provenance =
		"data" in joined.body
			? (
					joined.body.data as {
						provenance: {
							geography: { match: { status: string } };
							transformation: { status: string };
						};
					}
				).provenance
			: undefined;
	assert.equal(
		provenance?.geography.match.status,
		"caller-selected-code-join",
	);
	assert.equal(provenance?.transformation.status, "not-applied");

	// A route that cannot join geometry refuses the release rather than
	// ignoring it, so no caller can read it as a conversion that happened.
	for (const query of DERIVATIVE) {
		const refused = route(
			"GET",
			`${query}&release=2023-05-uk-bgc`,
			catalogues,
		);
		assert.equal(refused.status, 422, query);
		assert.match(
			"detail" in refused.body ? refused.body.detail : "",
			/geometry release/,
			query,
		);
	}
});
