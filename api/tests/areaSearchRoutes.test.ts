import assert from "node:assert/strict";
import test from "node:test";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
} from "./routeFixtures";

test("searches and paginates compiled area identities", () => {
	const byCode = route(
		"GET",
		"/v1/areas?q=e05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(byCode.status, 200);
	assert.deepEqual("data" in byCode.body && byCode.body.data, [
		{
			id: "ward/2025-01-en-ward/E05000001",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			code: "E05000001",
			name: "Example ward",
			aliases: ["Enghraifft ward"],
		},
	]);

	const byAlias = route(
		"GET",
		"/v1/areas?q=gm",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(byAlias.status, 200);
	assert.deepEqual("data" in byAlias.body && byAlias.body.data, [
		{
			id: "localAuthority/2025-01-uk-lad/E08000001",
			geography: "localAuthority",
			boundaryRelease: "2025-01-uk-lad",
			code: "E08000001",
			name: "Greater Manchester",
			aliases: ["GM"],
		},
	]);

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
