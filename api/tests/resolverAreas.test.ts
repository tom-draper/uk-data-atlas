import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { AreasResolver } from "../src/resolver/areas";

const areaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:ward-2020",
		geography: "ward",
		boundaryRelease: "2020",
		codeProperty: "WD20CD",
		nameProperty: "WD20NM",
		areas: [{ code: "W001", name: "Old ward" }],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:ward-2024",
		geography: "ward",
		boundaryRelease: "2024",
		codeProperty: "WD24CD",
		nameProperty: "WD24NM",
		areas: [{ code: "W001", name: "Current ward" }],
	},
]);

test("AreasResolver looks up areas and same-code releases", () => {
	const resolver = new AreasResolver({ areaLookup });
	const identity = {
		geography: "ward",
		boundaryRelease: "2024",
		code: "W001",
	};

	assert.equal(resolver.hasAreas(), true);
	assert.deepEqual(resolver.area(identity), {
		code: "W001",
		name: "Current ward",
	});
	assert.deepEqual(resolver.sameCode(identity), [
		{
			id: "ward/2020/W001",
			geography: "ward",
			boundaryRelease: "2020",
			code: "W001",
			name: "Old ward",
			status: "same-code-continuity",
		},
	]);
	assert.equal(resolver.area({ ...identity, code: "missing" }), undefined);
});

test("AreasResolver stays empty when area identities are unavailable", () => {
	const resolver = new AreasResolver({});
	assert.equal(resolver.hasAreas(), false);
	assert.equal(
		resolver.area({ geography: "ward", boundaryRelease: "2024", code: "W001" }),
		undefined,
	);
	assert.equal(resolver.areaCodes("ward", "2024"), undefined);
});
