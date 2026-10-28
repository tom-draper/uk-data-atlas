import assert from "node:assert/strict";
import test from "node:test";
import type { GeoJsonGeometry } from "@uk-data-atlas/atlas-runtime/geometry";
import { route } from "../src/routes";
import {
	testContext,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
} from "./routeFixtures";

const parent = {
	geography: "localAuthority",
	boundaryRelease: "2025-01-uk-lad",
	code: "E08000001",
};
const child = {
	geography: "ward",
	boundaryRelease: "2025-01-en-ward",
	code: "E05000001",
};
const childrenUrl =
	"/v1/areas/localAuthority/2025-01-uk-lad/E08000001/children/geometry";
const boxUrl =
	"/v1/areas:intersects?bbox=-3,53,0,56&geography=ward&release=2025-01-en-ward";
const geometry = (vertices: number): GeoJsonGeometry => ({
	type: "Polygon",
	coordinates: [
		Array.from({ length: vertices }, (_, i) => [-2 + i / vertices, 54]),
	],
});
const context = () =>
	testContext({
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	});

test("refuses too many children before reading any geometry", (t) => {
	const ctx = context();
	t.mock.method(ctx.geographyResolver, "missingRequirement", () => undefined);
	const children = ctx.geographyResolver.relationships(parent, "contains");
	assert.equal(children.length, 1);
	t.mock.method(ctx.geographyResolver, "relationships", () =>
		Array.from({ length: 1001 }, () => children[0]!),
	);
	const reads = t.mock.method(ctx.geographyResolver, "geometryFor", () => {
		throw new Error("Must not load geometry");
	});
	const response = route("GET", childrenUrl, ctx);
	assert.equal(response.status, 422);
	assert.equal(reads.mock.callCount(), 0);
	assert.ok("detail" in response.body);
	assert.match(String(response.body.detail), /1,000/);
	assert.ok("links" in response.body);
	assert.equal(
		response.body.links?.downloads,
		"/v1/boundary-releases/ward/2025-01-en-ward",
	);
});

test("refuses a child whose source vertex count exceeds the budget before simplification", (t) => {
	const ctx = context();
	t.mock.method(ctx.geographyResolver, "missingRequirement", () => undefined);
	t.mock.method(ctx.geographyResolver, "geometryFor", () => ({
		geometry: geometry(250001),
		geometrySource: { sourceCrs: "EPSG:4326" },
	}));
	for (const tier of ["full", "low"]) {
		const response = route("GET", `${childrenUrl}?tier=${tier}`, ctx);
		assert.equal(response.status, 422);
		assert.ok("detail" in response.body);
		assert.match(String(response.body.detail), /250,000/);
	}
});

test("loads box geometries incrementally and stops when their cumulative vertices exceed the budget", (t) => {
	const ctx = context();
	const area = ctx.geographyResolver.area(child)!;
	const match = {
		...child,
		...area,
		id: "ward/2025-01-en-ward/E05000001",
		relation: "within" as const,
		boundingBox: [-2, 54, -1, 55] as [number, number, number, number],
		geometrySource: { sourceCrs: "EPSG:4326" },
	};
	const find = t.mock.method(
		ctx.geographyResolver,
		"intersectingAreas",
		() => ({ matched: 3, more: false, matches: [match, match, match] }),
	);
	const reads = t.mock.method(ctx.geographyResolver, "geometryFor", () => ({
		geometry: geometry(125001),
		geometrySource: { sourceCrs: "EPSG:4326" },
	}));
	const response = route("GET", `${boxUrl}&tier=full`, ctx);
	assert.equal(response.status, 422);
	assert.equal(find.mock.calls[0]!.arguments[4], false);
	assert.equal(reads.mock.callCount(), 2);
	assert.ok("links" in response.body);
	assert.equal(
		response.body.links?.downloads,
		"/v1/boundary-releases/ward/2025-01-en-ward",
	);
	reads.mock.resetCalls();
	assert.equal(route("GET", boxUrl, ctx).status, 200);
	assert.equal(reads.mock.callCount(), 0);
});

test("accepts a collection at the source vertex budget", (t) => {
	const ctx = context();
	t.mock.method(ctx.geographyResolver, "missingRequirement", () => undefined);
	t.mock.method(ctx.geographyResolver, "geometryFor", () => ({
		geometry: geometry(250000),
		geometrySource: { sourceCrs: "EPSG:4326" },
	}));
	const response = route("GET", childrenUrl, ctx);
	assert.equal(response.status, 200);
	assert.ok("data" in response.body);
});
