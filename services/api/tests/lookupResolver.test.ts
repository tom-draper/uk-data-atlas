import assert from "node:assert/strict";
import test from "node:test";
import { createLookupResolver } from "../../../pipeline/src/lookupResolver";
import { createGeographyResolver } from "@uk-data-atlas/atlas-runtime/areas";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";

test("lookup compilation uses only area and crosswalk inputs", () => {
	const areaLookup = new Map([
		["ward/2024", new Map([["W1", { code: "W1", name: "One" }]])],
		["ward/2025", new Map([["W1", { code: "W1", name: "One" }]])],
	]);
	const crosswalkInventory: CrosswalkInventory = {
		schemaVersion: 1,
		contentHash: "inventory",
		crosswalks: [],
	};
	const inputs = {
		areaLookup,
		crosswalkInventory,
		crosswalkLookup: new Map(),
	};
	const focused = createLookupResolver(inputs);
	const original = createGeographyResolver(inputs);
	assert.equal(focused.hasAreaRelease("ward", "2024"), true);
	assert.deepEqual(focused.areaCodes("ward", "2024"), ["W1"]);
	assert.equal(focused.hasAreaRelease("ward", "missing"), false);
	assert.equal(focused.areaCodes("ward", "missing"), undefined);
	assert.deepEqual(
		focused.crosswalkSummaries(),
		original.crosswalkSummaries(),
	);
	assert.equal(focused.crosswalk("missing"), undefined);
	const source = { geography: "ward", boundaryRelease: "2024", code: "W1" };
	const target = { geography: "ward", boundaryRelease: "2025" };
	assert.deepEqual(
		focused.sameArea(source, target),
		original.sameArea(source, target),
	);
	assert.deepEqual(
		focused.successorArea(source, target),
		original.successorArea(source, target),
	);
});
