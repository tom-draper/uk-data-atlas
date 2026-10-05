import assert from "node:assert/strict";
import test from "node:test";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
} from "./routeFixtures";

test("lists compiled area identities a page at a time", () => {
	const first = route(
		"GET",
		"/v1/areas?geography=ward&limit=1",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(first.status, 200);
	assert.deepEqual("data" in first.body && first.body.data, [
		{
			id: "ward/2025-01-en-ward/E05000001",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			code: "E05000001",
			name: "Example ward",
			aliases: ["Enghraifft ward"],
		},
	]);
	const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
	assert.equal(typeof cursor, "string");
	assert.ok(cursor);

	const second = route(
		"GET",
		"/v1/areas?geography=ward&limit=1&cursor=" + cursor,
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(second.status, 200);
	assert.deepEqual("data" in second.body && second.body.data, [
		{
			id: "ward/2025-01-en-ward/E05000002",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			code: "E05000002",
			name: "Other ward",
		},
	]);
	assert.equal("meta" in second.body && second.body.meta.nextCursor, null);
});

test("rejects unknown list filters and resolves latest to a concrete release", () => {
	const latest = route(
		"GET",
		"/v1/areas?geography=ward&release=latest",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(latest.status, 200);
	assert.equal(
		latest.headers?.["content-location"],
		"/v1/areas?geography=ward&release=2025-01-en-ward",
	);

	const unknownGeography = route(
		"GET",
		"/v1/areas?geography=wardd",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(unknownGeography.status, 404);
	const unknownRelease = route(
		"GET",
		"/v1/areas?geography=ward&release=1999-01-en-ward",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(unknownRelease.status, 404);
});

test("sends a name search to places rather than listing every area", () => {
	const response = route(
		"GET",
		"/v1/areas?q=manchester",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 400);
	assert.match(
		(response.body as { detail: string }).detail,
		/\/v1\/places\?q=manchester/,
	);
});
