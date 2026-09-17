import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { renderDocsPage, type OpenApiGuide } from "../src/docsPage";
import { route } from "../src/routes";
import { readApiCatalogues } from "../src/server";

/**
 * The documentation landing page and the guide it is rendered from. The quick
 * starts are copy-paste requests, so each is sent here: a quick start that
 * stops working fails the build rather than a reader's first attempt.
 */

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogues = readApiCatalogues(apiRoot);
const openapi = parse(
	readFileSync(resolve(apiRoot, "openapi.yaml"), "utf8"),
) as OpenApiGuide;
const readme = readFileSync(resolve(apiRoot, "README.md"), "utf8");

const templates = Object.keys(openapi.paths).map((path) => ({
	path,
	pattern: new RegExp(
		`^/v1${path
			.replace(/[.*+?^$()|[\]\\]/g, "\\$&")
			.replace(/\{[^}]+\}/g, "[^/]+")}$`,
	),
}));
const operationFor = (request: string) =>
	templates.find(({ pattern }) => pattern.test(request.split("?")[0]!));

/** The rows of the README table that starts with `header`. */
const readmeTable = (header: string) => {
	const start = readme.indexOf(`\n${header}\n`);
	assert.notEqual(start, -1, `the README has no table headed ${header}`);
	return readme
		.slice(start + header.length + 2)
		.split("\n")
		.slice(1)
		.filter((line, index, lines) =>
			lines.slice(0, index + 1).every((row) => row.startsWith("|")),
		)
		.map((line) =>
			line
				.split("|")
				.slice(1, -1)
				.map((cell) => cell.trim()),
		);
};

test("publishes the three golden-path quick starts", () => {
	assert.deepEqual(
		openapi["x-quick-starts"].map((guide) => guide.id),
		["correct-map", "defensible-trend", "reliable-sync"],
	);
	for (const guide of openapi["x-quick-starts"]) {
		assert.ok(guide.steps.length >= 4, `${guide.id} is too short to teach`);
		// Each shows at least one thing the API will not do, except a sync,
		// whose point is that nothing surprising happens.
		if (guide.id !== "reliable-sync")
			assert.ok(
				guide.steps.some((step) => (step.status ?? 200) >= 400),
				`${guide.id} shows no refusal`,
			);
	}
});

test("answers every quick start request as the guide says it will", () => {
	const problems = openapi["x-quick-starts"].flatMap((guide) =>
		guide.steps.flatMap((step) => {
			const name = `${guide.id}: ${step.title}`;
			if (!step.request.startsWith("/v1/"))
				return [`${name}: ${step.request} is not a /v1 request`];
			if (!operationFor(step.request))
				return [`${name}: ${step.request} is not a documented operation`];
			const response = route("GET", step.request, catalogues);
			const expected = step.status ?? 200;
			return response.status === expected
				? []
				: [`${name}: ${step.request} answered ${response.status}, not ${expected}`];
		}),
	);
	assert.deepEqual(problems, []);
});

test("sends the endpoint chooser only to documented routes", () => {
	const documented = new Set(Object.keys(openapi.paths));
	const unknown = openapi["x-endpoint-chooser"].flatMap((row) =>
		row.start.filter((path) => !documented.has(path)),
	);
	assert.deepEqual(unknown, []);
	// The README's chooser is the proposal this one publishes, job for job.
	assert.deepEqual(
		readmeTable("| I need to… | Start here |").map(([need]) => need),
		openapi["x-endpoint-chooser"].map((row) => row.need),
	);
});

test("publishes the README's glossary word for word", () => {
	assert.deepEqual(
		readmeTable("| Term | Meaning |").map(([term, meaning]) => ({
			term: term!.replaceAll("**", ""),
			meaning,
		})),
		openapi["x-glossary"],
	);
});

test("serves the landing page the index points to", () => {
	const index = route("GET", "/v1", catalogues).body as {
		data: { documentation: string; links: string[] };
	};
	assert.equal(index.data.documentation, "/v1/docs");
	const response = route("GET", index.data.documentation, catalogues);
	assert.equal(response.status, 200);
	assert.equal(
		response.representation?.contentType,
		"text/html; charset=utf-8",
	);
	const html = String(response.representation?.body);
	assert.match(html, /^<!doctype html>/);
	assert.ok(html.includes(catalogues.atlasRelease.releaseId));
	// Every operation, quick start step and glossary term is on the page.
	for (const item of Object.values(openapi.paths))
		assert.ok(
			html.includes(`id="${item.get!.operationId}"`),
			`${item.get!.operationId} is not on the page`,
		);
	for (const guide of openapi["x-quick-starts"])
		for (const step of guide.steps)
			assert.ok(
				html.includes(`href="${step.request.replaceAll("&", "&amp;")}"`),
				`${step.request} is not on the page`,
			);
	for (const entry of openapi["x-glossary"])
		assert.ok(html.includes(`<dt>${entry.term}</dt>`), entry.term);
});

test("escapes the document's text rather than trusting it as markup", () => {
	const html = renderDocsPage(
		{
			...openapi,
			info: { title: "<script>alert(1)</script>", description: "A `<b>` & B" },
			"x-glossary": [{ term: "<i>", meaning: '"quoted"' }],
		},
		"sha256:test",
	);
	assert.ok(!html.includes("<script>alert"));
	assert.ok(html.includes("&lt;script&gt;"));
	assert.ok(html.includes("<code>&lt;b&gt;</code> &amp; B"));
	assert.ok(html.includes("<dt>&lt;i&gt;</dt><dd>&quot;quoted&quot;</dd>"));
});
