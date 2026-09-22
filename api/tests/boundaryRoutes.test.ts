import assert from "node:assert/strict";
import test from "node:test";
import { createGeographyResolver } from "../src/geographyResolver";
import { route as routeRequest } from "../src/routes";
import type { RouteContext } from "../src/routing";
import { route, registry, geographyInventory } from "./routeFixtures";

test("lists published geographies", () => {
	const response = route("GET", "/v1/geographies", registry);
	assert.equal(response.status, 200);
	assert.deepEqual(response.body, {
		apiVersion: "v1",
		atlasRelease: "sha256:registry",
		data: [
			{ id: "ward", latestRelease: "2025-01-en-ward", releaseCount: 1 },
		],
		meta: { nextCursor: null },
	});
});

test("gets one boundary release", () => {
	const response = route(
		"GET",
		"/v1/boundary-releases/ward/2025-01-en-ward",
		registry,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body && response.body.data,
		registry.releases[0],
	);
});

test("publishes the geography compiler coverage", () => {
	const response = route(
		"GET",
		"/v1/geography-inventory",
		registry,
		geographyInventory,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body && response.body.data,
		geographyInventory,
	);
});

test("resolves the boundary release to use for a date", () => {
	const context: RouteContext = {
		boundaryRegistry: {
			...registry,
			releases: [
				...registry.releases,
				{ ...registry.releases[0]!, id: "2023-05-en-ward" },
			],
		},
	};
	context.geographyResolver = createGeographyResolver({
		boundaryRegistry: context.boundaryRegistry,
	});
	const resolve = (query: string) =>
		routeRequest("GET", `/v1/boundary-releases:resolve?${query}`, context);

	const inMonth = resolve("geography=ward&date=2025-01");
	assert.equal(inMonth.status, 200);
	const data = (inMonth.body as { data: Record<string, unknown> }).data;
	assert.equal((data.selected as { id: string }).id, "2025-01-en-ward");
	assert.equal(data.sameMonth, true);
	assert.equal((data.previous as { id: string }).id, "2023-05-en-ward");
	assert.equal(data.next, null);
	assert.equal(data.basis, "latest-release-dated-on-or-before");

	const between = resolve("geography=ward&date=2024-02-29");
	assert.equal(
		(between.body as { data: { selected: { id: string } } }).data.selected
			.id,
		"2023-05-en-ward",
	);

	assert.equal(resolve("geography=ward&date=2023-02-29").status, 400);
	assert.equal(resolve("date=2024-01-01").status, 400);
	assert.equal(resolve("geography=ward&date=2024-01&country=GB").status, 400);

	const early = resolve("geography=ward&date=2020-01-01");
	assert.equal(early.status, 404);
	assert.deepEqual(
		"code" in early.body && [early.body.code, early.body.absence],
		["no_release_for_date", "before-first-release"],
	);
	const unknownGeography = resolve("geography=parish&date=2024-01");
	assert.equal(
		"code" in unknownGeography.body && unknownGeography.body.code,
		"unsupported_geography",
	);
});
