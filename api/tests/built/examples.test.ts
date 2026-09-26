import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createClient } from "../../examples/client";
import { run as correctMap } from "../../examples/correct-map";
import {
	plan as mapPlan,
	run as correctMapRender,
	tutorialPage,
} from "../../examples/correct-map-render";
import { run as defensibleTrend } from "../../examples/defensible-trend";
import { run as reliableSync } from "../../examples/reliable-sync";
import { createApiServer, readApiCatalogues } from "../../src/server";

/**
 * The golden paths, run against a real server over HTTP. They use only the
 * published contract, so a change that breaks a documented workflow fails here
 * rather than in a customer's integration.
 *
 * The map tutorial is the Phase 1 release gate. It cannot be rendered in a
 * test, so what is checked is everything up to handing MapLibre the style: the
 * URLs all resolve, the values are numbered for the layer the style draws, and
 * the page carries the citation.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("walks the golden paths against a running server", async (t) => {
	const server = createApiServer(readApiCatalogues(apiRoot));
	await new Promise<void>((ready) => {
		server.listen(0, "127.0.0.1", ready);
	});
	t.after(() => {
		server.close();
	});
	const { port } = server.address() as AddressInfo;
	const client = createClient(`http://127.0.0.1:${port}`);

	for (const [path, walk] of [
		["correct map", correctMap],
		["correct map render", correctMapRender],
		["defensible trend", defensibleTrend],
		["reliable sync", reliableSync],
	] as const) {
		const steps = await walk(client);
		assert.ok(steps.length >= 5, `${path} took only ${steps.length} steps`);
		assert.deepEqual(
			steps.filter((step) => step.detail.trim().length === 0),
			[],
			`${path} has a step that says nothing`,
		);
	}

	const trend = await defensibleTrend(client);
	assert.ok(
		trend.some((step) => step.title === "Preflight the conversion"),
		"the trend must check reviewed support before using a converted value",
	);
	assert.ok(
		trend.some((step) => step.title === "Retain the validation receipt"),
		"the trend must retain conservation evidence for its conversion",
	);
	assert.ok(
		trend.some(
			(step) =>
				step.title === "Keep an unsafe period out" &&
				step.detail.includes("not-comparable"),
		),
		"the trend must show an unsafe period as not-comparable",
	);
});

test("builds a map the tutorial page can actually draw", async (t) => {
	const server = createApiServer(readApiCatalogues(apiRoot));
	await new Promise<void>((ready) => {
		server.listen(0, "127.0.0.1", ready);
	});
	t.after(() => {
		server.close();
	});
	const { port } = server.address() as AddressInfo;
	const baseUrl = `http://127.0.0.1:${port}`;
	const client = createClient(baseUrl);
	const plan = await mapPlan(client);

	// The style must draw the layer the values were numbered for, or the
	// feature state lands on nothing.
	const layers = plan.style.layers as Array<{
		id: string;
		"source-layer": string;
	}>;
	const sources = plan.style.sources as {
		boundaries: { tiles: string[]; attribution: string };
	};
	assert.ok(layers.length > 0);
	const [layer] = new Set(layers.map((entry) => entry["source-layer"]));
	const tileJson = await client.get<{ vector_layers: Array<{ id: string }> }>(
		`/v1/map-resources/localAuthority/2023-05-uk-bgc-v2/tiles.json`,
	);
	assert.equal(layer, tileJson.data.vector_layers[0]!.id);

	// Every tile URL the style names is served.
	for (const template of sources.boundaries.tiles) {
		const url = template
			.replace("{z}", "0")
			.replace("{x}", "0")
			.replace("{y}", "0");
		const response = await fetch(`${baseUrl}${url}`);
		assert.equal(response.status, 200, url);
		assert.equal(
			response.headers.get("content-type"),
			"application/vnd.mapbox-vector-tile",
		);
	}

	// A map that cannot be cited is not the product. The attribution travels
	// in the style and on the page, and the page names the release and the
	// tiles it was drawn from.
	assert.ok(sources.boundaries.attribution.length > 0);
	const page = tutorialPage(plan, baseUrl);
	for (const required of [
		plan.citation.attribution,
		plan.citation.atlasRelease,
		plan.citation.archiveContentHash,
		plan.noDataColour,
		"setFeatureState",
	])
		assert.ok(page.includes(required), `the page omits ${required}`);
	assert.ok(plan.values.length > 0);
});
