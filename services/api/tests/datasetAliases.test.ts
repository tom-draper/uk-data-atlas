import assert from "node:assert/strict";
import { test } from "vitest";
import {
	DATASET_ALIASES,
	datasetAliasOf,
	REGISTERED_DATASETS,
} from "@uk-data-atlas/datasets/registry";
import { resolveDatasetAliases } from "../src/datasetAliasRequests";
import { route } from "../src/routes";
import { dataCatalog, registry, testContext } from "./routeFixtures";

test("every alias names a registered dataset and never reuses a live id", () => {
	const ids = new Set(REGISTERED_DATASETS.map((dataset) => dataset.id));
	for (const [old, alias] of Object.entries(DATASET_ALIASES)) {
		assert.ok(
			ids.has(alias.dataset),
			`${old} resolves to ${alias.dataset}`,
		);
		assert.ok(!ids.has(old), `${old} is retired, so no dataset may use it`);
		assert.ok(alias.geography || alias.period || old !== alias.dataset);
	}
});

test("looks up aliases without matching inherited object keys", () => {
	assert.equal(datasetAliasOf("regional-gdp-itl2")?.dataset, "regional-gdp");
	assert.equal(datasetAliasOf("regional-gdp-itl2")?.geography, "itl2");
	assert.equal(datasetAliasOf("toString"), undefined);
	assert.equal(datasetAliasOf("regional-gdp"), undefined);
});

test("redirects a retired dataset detail address to the merged dataset", () => {
	const resolved = resolveDatasetAliases(
		"/v1/datasets/regional-gdp-itl1",
		() => "r",
	);
	assert.equal(resolved.kind, "redirect");
	if (resolved.kind !== "redirect") return;
	assert.equal(resolved.response.status, 308);
	assert.equal(
		resolved.response.headers?.location,
		"/v1/datasets/regional-gdp",
	);
	const response = route(
		"GET",
		"/v1/datasets/regional-gdp-itl3",
		testContext({ boundaryRegistry: registry, dataCatalog }),
	);
	assert.equal(response.status, 308);
	assert.equal(response.headers?.location, "/v1/datasets/regional-gdp");
});

test("rewrites datasetId and narrows data requests to the old geography", () => {
	const resolved = resolveDatasetAliases(
		"/v1/data/gva?datasetId=regional-gdp-itl2&period=2023",
		() => "r",
	);
	assert.equal(resolved.kind, "rewritten");
	if (resolved.kind !== "rewritten") return;
	const url = new URL(resolved.url, "http://localhost");
	assert.equal(url.pathname, "/v1/data/gva");
	assert.equal(url.searchParams.get("datasetId"), "regional-gdp");
	assert.equal(url.searchParams.get("geography"), "itl2");
	assert.equal(url.searchParams.get("period"), "2023");
});

test("resolves a retired school performance id to the merged dataset on constituencies", () => {
	assert.deepEqual(datasetAliasOf("school-performance-constituency"), {
		dataset: "school-performance",
		geography: "constituency",
	});
	const redirect = resolveDatasetAliases(
		"/v1/datasets/school-performance-constituency",
		() => "r",
	);
	assert.equal(redirect.kind, "redirect");
	const rewritten = resolveDatasetAliases(
		"/v1/data/attainment8?datasetId=school-performance-constituency",
		() => "r",
	);
	assert.equal(rewritten.kind, "rewritten");
	if (rewritten.kind !== "rewritten") return;
	const url = new URL(rewritten.url, "http://localhost");
	assert.equal(url.searchParams.get("datasetId"), "school-performance");
	assert.equal(url.searchParams.get("geography"), "constituency");
});

test("keeps a geography the caller chose and leaves non-data paths alone", () => {
	const chosen = resolveDatasetAliases(
		"/v1/data/gva?datasetId=regional-gdp-itl2&geography=itl3",
		() => "r",
	);
	assert.equal(chosen.kind, "rewritten");
	if (chosen.kind === "rewritten")
		assert.equal(
			new URL(chosen.url, "http://localhost").searchParams.get(
				"geography",
			),
			"itl3",
		);
	const catalogue = resolveDatasetAliases(
		"/v1/measures?datasetId=regional-gdp-itl1",
		() => "r",
	);
	assert.equal(catalogue.kind, "rewritten");
	if (catalogue.kind === "rewritten")
		assert.equal(
			new URL(catalogue.url, "http://localhost").searchParams.has(
				"geography",
			),
			false,
		);
});

test("leaves current dataset ids and other requests unchanged", () => {
	for (const url of [
		"/v1/datasets/regional-gdp",
		"/v1/datasets/population",
		"/v1/data/gva?datasetId=regional-gdp",
		"/v1/data/gva?datasetId=toString",
		"/v1/data/gva",
	])
		assert.equal(
			resolveDatasetAliases(url, () => "r").kind,
			"unchanged",
			url,
		);
});
