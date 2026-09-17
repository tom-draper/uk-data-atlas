import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { httpResponse } from "../src/httpResponse";
import { CAPABILITY_STATUSES } from "../src/capability";
import { CONVERSION_METHODS } from "../src/conversion";
import { COMPATIBILITY_STATUSES } from "../src/measureCompatibility";
import { PROBLEM_CODES } from "../src/problemCodes";
import { route } from "../src/routes";
import { GEOMETRY_TIERS } from "../src/simplifyGeometry";
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
		const content = item.get?.responses["200"]?.content ?? {};
		// A representation that is not JSON, such as a lookup's CSV, shows the
		// first rows; the served body must start with exactly those bytes.
		const text = Object.entries(content).flatMap(([type, entry]) =>
			type !== "application/json" && entry.example !== undefined
				? [
						{
							name: `${path} [${type}]`,
							request: entry["x-example-request"],
							value: entry.example,
							prefix: true,
						},
					]
				: [],
		);
		const media = content["application/json"];
		if (!media) return text;
		if (media.example !== undefined)
			return [
				...text,
				{
					name: path,
					request: media["x-example-request"],
					value: media.example,
					prefix: false,
				},
			];
		return [
			...text,
			...Object.entries(media.examples ?? {}).map(([name, example]) => ({
				name: `${path} ${name}`,
				request: example["x-example-request"],
				value: example.value,
				prefix: false,
			})),
		];
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
	const drifted = responseExamples.flatMap(
		({ name, request, value, prefix }) => {
			if (!request) return [];
			// Release ids change with every build, so an example request that
			// needs one names the release the server holds by placeholder.
			const response = route(
				"GET",
				request.replaceAll(
					"{current-atlas-release}",
					catalogues.atlasRelease.releaseId,
				),
				catalogues,
			);
			if (response.status !== 200)
				return [`${name}: ${request} returned ${response.status}`];
			if (prefix) {
				const body = String(response.representation?.body ?? "");
				return body.startsWith(String(value))
					? []
					: [`${name}: the response does not start with the example`];
			}
			return departures(value, response.body, "").map(
				(departure) => `${name}${departure}`,
			);
		},
	);
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

/**
 * The map resource contract specifies routes that are not built yet, but it
 * borrows vocabulary that is: tier names, a problem code, the cache header and
 * the routes it tells a caller to use instead. Those can drift away from it
 * silently, so they are checked here. The proposed routes are checked to be
 * absent, which is the claim the section opens with; when the compiler lands,
 * this test is the reminder to say so.
 */
const mapContract = (() => {
	const heading = "\n## Map resource contract\n";
	const start = readme.indexOf(heading);
	assert.notEqual(start, -1, "the map resource contract section is missing");
	const end = readme.indexOf("\n## ", start + heading.length);
	return readme.slice(start, end);
})();

test("holds the map resource contract to the vocabulary it borrows", () => {
	// The tier ladder it shares with the per-area geometry route.
	assert.ok(
		mapContract.includes(
			Object.keys(GEOMETRY_TIERS)
				.map((tier) => `\`${tier}\``)
				.join(", "),
		),
		"the contract's tier names are not the tiers the API serves",
	);

	// Any snake_case identifier it quotes is a declared problem code.
	const quotedCodes = [
		...mapContract.matchAll(/`([a-z]+(?:_[a-z]+)+)`/g),
	].map((match) => match[1]!);
	assert.notEqual(quotedCodes.length, 0);
	assert.deepEqual(
		quotedCodes.filter((code) => !(code in PROBLEM_CODES)),
		[],
		"problem codes the contract names but the API does not declare",
	);

	// The cache header it quotes for an unpinned response is the one served.
	const served = httpResponse({ method: "GET", headers: {} }, () =>
		route("GET", "/v1", catalogues),
	);
	assert.ok(
		mapContract.includes(served.headers["cache-control"]!),
		"the contract quotes a cache policy the API does not apply",
	);
});

test("serves the map resource contract's routes, or marks them unbuilt", () => {
	const routes = [
		...mapContract.matchAll(
			/^(not built: )?GET (\/v1\/map-resources\S*)$/gm,
		),
	].map((match) => ({
		built: match[1] === undefined,
		path: match[2]!.split("?")[0]!,
	}));
	assert.equal(routes.length, 7);
	assert.equal(routes.filter((entry) => entry.built).length, 7);

	// What the contract presents as available must answer, and what it marks
	// unbuilt must not, so the section cannot quietly fall behind the server.
	const served = (path: string) =>
		!isUnrouted(path.replace(/\{[^}]+\}/g, "placeholder"));
	assert.deepEqual(
		routes.filter((entry) => entry.built && !served(entry.path)),
		[],
		"the contract offers a map route the API does not serve",
	);
	assert.deepEqual(
		routes.filter((entry) => !entry.built && served(entry.path)),
		[],
		"a map route is served but the contract still marks it unbuilt",
	);

	// Every other route it cites as the way to do something today must work.
	const cited = [...mapContract.matchAll(/`(\/v1\/[^`]*)`/g)]
		.map((match) => match[1]!.split("?")[0]!)
		.filter(
			(path) => !path.includes("...") && !path.includes("/map-resources"),
		);
	assert.notEqual(cited.length, 0);
	assert.deepEqual(
		cited.filter((path) =>
			isUnrouted(path.replace(/\{[^}]+\}/g, "placeholder")),
		),
		[],
		"the contract sends a caller to a route that does not exist",
	);
});

/**
 * The resolution contract describes a layer that is not built, but it names
 * vocabulary that is: the compatibility statuses a join may be accepted on,
 * the conversion methods, the problem codes a refusal may carry and the build
 * artifacts it reads. If any of those are renamed, the contract becomes wrong
 * about the system it is meant to govern, so they are checked here.
 */
const resolutionContract = (() => {
	const heading = "\n## Resolution contract\n";
	const start = readme.indexOf(heading);
	assert.notEqual(start, -1, "the resolution contract section is missing");
	const end = readme.indexOf("\n## ", start + heading.length);
	return readme.slice(start, end);
})();

test("holds the resolution contract to the vocabulary it borrows", () => {
	// Every kebab-case or snake_case term it quotes must be something the
	// system really has: a compatibility status, a conversion method, or a
	// declared problem code.
	const known = new Set([
		...COMPATIBILITY_STATUSES,
		...CONVERSION_METHODS,
		...Object.keys(PROBLEM_CODES),
	]);
	const quoted = [
		...resolutionContract.matchAll(/`([a-z]+(?:[-_][a-z]+)+)`/g),
	].map((match) => match[1]!);
	assert.notEqual(quoted.length, 0);
	assert.deepEqual(
		quoted.filter((term) => !known.has(term)),
		[],
		"the resolution contract names a status, method or code the API does not have",
	);

	// A join may only be accepted on a status that really means every source
	// code is present, which is the rule the data routes already apply.
	for (const status of ["exact-code-set", "code-set-compatible"])
		assert.ok(
			resolutionContract.includes(`\`${status}\``),
			`the contract no longer names ${status} as a status a join is accepted on`,
		);
});

test("names build artifacts the resolution contract can actually read", () => {
	const artifacts = [
		...resolutionContract.matchAll(/`([a-z-]+\.json)`/g),
	].map((match) => match[1]!);
	assert.notEqual(artifacts.length, 0);
	assert.deepEqual(
		artifacts.filter(
			(name) => !existsSync(resolve(apiRoot, "public", name)),
		),
		[],
		"the resolution contract reads a build artifact that is not published",
	);
});

test("keeps the resolution contract's one exception the only one", () => {
	// The contract's claim is that no route decides for itself which partition
	// answers a request, bar one named exception. That is a claim about the
	// source, so it is checked against the source rather than trusted.
	// Only the paragraph that makes the claim counts. The route is named
	// elsewhere in the section as history, which would let this pass whatever
	// the exception had become.
	const exception = resolutionContract.slice(
		resolutionContract.indexOf("**One route does not use it"),
	);
	const named = [...exception.matchAll(/`([a-zA-Z]+Routes)`/g)].map(
		(match) => match[1]!,
	);
	assert.deepEqual(
		named,
		["bulkRoutes"],
		"the contract's exception paragraph no longer names exactly the route that is excepted",
	);

	const routes = readdirSync(resolve(apiRoot, "src")).filter((file) =>
		file.endsWith("Routes.ts"),
	);
	const choosing = routes.filter((file) =>
		/measure\??\.sources\.(find|filter)\(/.test(
			readFileSync(resolve(apiRoot, "src", file), "utf8"),
		),
	);
	assert.deepEqual(
		choosing,
		["bulkRoutes.ts"],
		"a route chooses its own partition; either it should ask the resolver, or the contract should say why it does not",
	);

	// And the resolver is really what the rest of them ask.
	const asking = routes.filter((file) =>
		readFileSync(resolve(apiRoot, "src", file), "utf8").includes(
			"resolveObservations",
		),
	);
	assert.ok(
		asking.length >= 8,
		`only ${asking.length} routes ask the resolver`,
	);
});

/**
 * The analysis contract specifies Phase 2 and builds nothing, but it decides
 * what may be converted from the semantics a measure already declares. If those
 * are renamed the rule stops meaning anything, so the names are checked, and so
 * is the claim that none of it is served yet.
 */
const analysisContract = (() => {
	const heading = "\n## Analysis contract\n";
	const start = readme.indexOf(heading);
	assert.notEqual(start, -1, "the analysis contract section is missing");
	const end = readme.indexOf("\n## ", start + heading.length);
	return readme.slice(start, end);
})();

test("holds the analysis contract to the semantics it rules on", () => {
	// Every aggregation kind the catalogue distinguishes must be ruled on:
	// silence about one is how an unconvertible measure gets converted.
	const kinds = new Set(
		(catalogues.dataCatalog?.measures ?? []).map(
			(measure) => measure.aggregation.kind,
		),
	);
	assert.ok(kinds.size >= 3, `only ${kinds.size} aggregation kinds in use`);
	assert.deepEqual(
		[...kinds].filter((kind) => !analysisContract.includes(`\`${kind}\``)),
		[],
		"the analysis contract does not say what happens to every kind of measure",
	);

	// The statistics it names as never convertible are really the ones the
	// catalogue calls non-aggregatable.
	const statistics = new Set(
		(catalogues.dataCatalog?.measures ?? []).flatMap((measure) =>
			measure.aggregation.kind === "non-aggregatable"
				? [measure.aggregation.statistic]
				: [],
		),
	);
	assert.deepEqual(
		[...statistics].filter(
			(statistic) => !analysisContract.includes(statistic),
		),
		[],
		"a statistic the catalogue calls non-aggregatable is not named as unconvertible",
	);
});

test("keeps the analysis contract's routes unbuilt", () => {
	const proposed = [
		...analysisContract.matchAll(/^not built: GET (\/v1\/\S*)$/gm),
	].map((match) => match[1]!.split("?")[0]!);
	assert.equal(proposed.length, 3);
	assert.deepEqual(
		proposed.filter(
			(path) => !isUnrouted(path.replace(/\{[^}]+\}/g, "placeholder")),
		),
		[],
		"an analysis route is served; the contract still says it is not",
	);
});

/**
 * Every capability answer speaks one vocabulary. These walk the live answers
 * a caller gets across geographies, nations and measures, rather than a
 * fixture, because the promise is about what the compiled catalogue says.
 */
const capabilityAnswers = (url: string) => {
	const response = route("GET", url, catalogues);
	assert.equal(response.status, 200, url);
	const data = (response.body as { data: Record<string, any> }).data;
	if (data.capabilities) {
		const {
			geometry,
			relationships,
			namedLocations,
			data: measures,
		} = data.capabilities;
		return [
			geometry,
			relationships,
			namedLocations,
			measures,
			...(measures.measures ?? []),
		];
	}
	if (data.target) return [data.target];
	return [data];
};

const CAPABILITY_REQUESTS = [
	"/v1/areas/localAuthority/2023-05-uk-bgc-v2/E08000035/capabilities",
	"/v1/areas/localAuthority/2025-12-uk-bgc/S12000049/capabilities",
	"/v1/areas/localAuthority/2025-12-uk-bgc/N09000003/capabilities",
	"/v1/areas/ward/2024-12-uk-bgc/E05011403/capabilities",
	"/v1/areas/lsoa/2021-12-ew-bgc-v5/E01011264/capabilities",
	"/v1/areas/region/2025-12-en-bgc/E12000003/capabilities",
	"/v1/measures/population-estimate/coverage?geography=ward&release=2023-05-uk-bgc",
	"/v1/measures/population-estimate/coverage?geography=localAuthority&release=2025-12-uk-bgc",
	"/v1/measures/road-collisions/coverage?geography=localAuthority&release=2023-05-uk-bgc-v2",
	"/v1/measures/general-election-turnout/coverage?geography=localAuthority&release=2024-05-uk-bgc",
	"/v1/relationship-paths?sourceGeography=ward&sourceRelease=2023-05-uk-bgc&targetGeography=localAuthority&targetRelease=2023-05-uk-bgc-v2&purpose=membership",
	"/v1/relationship-paths?sourceGeography=ward&sourceRelease=2023-05-uk-bgc&targetGeography=localAuthority&targetRelease=2023-05-uk-bgc-v2&purpose=identity",
];

test("documents exactly the capability vocabulary the API speaks", () => {
	assert.deepEqual(
		openapi.components.schemas.CapabilityStatus as unknown as {
			enum: string[];
		},
		{
			...(openapi.components.schemas.CapabilityStatus as object),
			enum: [...CAPABILITY_STATUSES],
		},
	);
});

test("answers every capability question in the vocabulary, with a reason", () => {
	const statuses = new Set<string>();
	const problems = CAPABILITY_REQUESTS.flatMap((url) =>
		capabilityAnswers(url).flatMap((answer, index) => {
			statuses.add(answer.status);
			return [
				...((CAPABILITY_STATUSES as readonly string[]).includes(
					answer.status,
				)
					? []
					: [`${url} [${index}]: status ${answer.status}`]),
				...(answer.status !== "available" &&
				(typeof answer.reason !== "string" ||
					answer.reason.length === 0)
					? [`${url} [${index}]: ${answer.status} without a reason`]
					: []),
				// A section summary, which carries counts, points at the
				// measures listed under it; each of those names its conversions.
				...(answer.status === "requires-conversion" &&
				!answer.counts &&
				!(answer.conversions?.length > 0)
					? [
							`${url} [${index}]: requires-conversion names no conversion`,
						]
					: []),
			];
		}),
	);
	assert.deepEqual(problems, []);
	// The sample is only worth something if it reaches the statuses a
	// catalogue built from real data actually produces.
	for (const status of [
		"available",
		"partial",
		"requires-conversion",
		"unsupported",
	])
		assert.ok(statuses.has(status), `no sampled answer is ${status}`);
});

test("offers only conversions that the convert route serves for the area", () => {
	const url =
		"/v1/areas/localAuthority/2023-05-uk-bgc-v2/E08000035/capabilities";
	const conversions = capabilityAnswers(url).flatMap(
		(answer) => answer.conversions ?? [],
	);
	assert.ok(conversions.length > 0);
	for (const { href } of conversions) {
		const response = route("GET", `${href}&limit=500`, catalogues);
		assert.equal(response.status, 200, href);
	}
});

test("lists an area's measures only from sources on its own geography", () => {
	// Ward and local authority releases share ids such as 2024-12-uk-bgc.
	const measures = capabilityAnswers(
		"/v1/areas/ward/2024-12-uk-bgc/E05011403/capabilities",
	).at(3).measures as Array<{
		sources?: Array<{ sourceGeography: { type: string } }>;
	}>;
	assert.deepEqual(
		[
			...new Set(
				measures.flatMap((measure) =>
					(measure.sources ?? []).map(
						(source) => source.sourceGeography.type,
					),
				),
			),
		],
		["ward"],
	);
});

test("holds the capability contract to the vocabulary the API speaks", () => {
	const heading = "\n## Capability contract\n";
	const start = readme.indexOf(heading);
	assert.notEqual(start, -1, "the capability contract section is missing");
	const section = readme.slice(
		start,
		readme.indexOf("\n## ", start + heading.length),
	);
	const listed = [...section.matchAll(/^- `([a-z-]+)`:/gm)].map(
		(match) => match[1]!,
	);
	assert.deepEqual(listed, [...CAPABILITY_STATUSES]);
});
