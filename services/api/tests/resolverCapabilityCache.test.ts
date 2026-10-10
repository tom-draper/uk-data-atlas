import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import {
	CapabilityResolver,
	type CapabilityResolverInputs,
} from "../src/resolver/capability";
import { CrosswalkTranslator } from "../src/resolver/translation";

test("caches relationship coverage across limits and health requests", () => {
	const areaLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:areas",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [
				{ code: "E05000001", name: "One" },
				{ code: "E05000002", name: "Two" },
			],
		},
	]);
	let relationshipCalls = 0;
	const resolver = new CapabilityResolver(
		{ areaLookup },
		new CrosswalkTranslator({}),
		() => {
			relationshipCalls += 1;
			return [];
		},
		() => true,
		() => undefined,
	);

	assert.equal(
		resolver.relationshipCoverage("ward", "2025-01-en-ward", undefined, 1)
			?.uncoveredAreas.length,
		1,
	);
	assert.equal(
		resolver.relationshipCoverage("ward", "2025-01-en-ward", undefined, 2)
			?.uncoveredAreas.length,
		2,
	);
	resolver.geographyHealth();
	resolver.geographyHealth();

	assert.equal(relationshipCalls, 2);
});

const wardArea = (code: string) => ({ code, name: code });
const compiledInputs = (
	areaInventoryHash: string,
	areaCount = 2,
): CapabilityResolverInputs => {
	const areaLookup = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:areas",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [wardArea("E05000001"), wardArea("E05000002")],
		},
	]);
	return {
		areaLookup,
		areaInventory: {
			schemaVersion: 1,
			contentHash: "sha256:area-inventory",
			boundaryRegistryHash: "sha256:registry",
			releases: [],
		},
		crosswalkInventory: {
			schemaVersion: 1,
			contentHash: "sha256:crosswalks",
			crosswalks: [],
			releaseCoverage: {
				areaInventoryHash,
				releases: [
					{
						geography: "ward",
						boundaryRelease: "2025-01-en-ward",
						areaCount,
						relatedAreaCount: 1,
					},
				],
			},
		},
	};
};

const healthOf = (
	inputs: CapabilityResolverInputs,
	calls: { codes: number; relationships: number },
) =>
	new CapabilityResolver(
		inputs,
		new CrosswalkTranslator({}),
		() => {
			calls.relationships += 1;
			return [];
		},
		() => true,
		() => undefined,
		() => {
			calls.codes += 1;
			return new Set(["E05000001", "E05000002"]);
		},
	).geographyHealth()[0];

test("takes a release's related area count from the compiled coverage when it is current", () => {
	const calls = { codes: 0, relationships: 0 };
	const health = healthOf(compiledInputs("sha256:area-inventory"), calls);

	assert.equal(health?.relatedAreaCount, 1);
	assert.equal(health?.status, "partial");
	assert.deepEqual(calls, { codes: 0, relationships: 0 });
});

test("counts from the crosswalks when the compiled coverage is for other areas", () => {
	// Compiled against another area inventory, then against another number of
	// areas in this release: neither can be trusted for the areas in hand.
	for (const inputs of [
		compiledInputs("sha256:another-inventory"),
		compiledInputs("sha256:area-inventory", 3),
	]) {
		const calls = { codes: 0, relationships: 0 };
		const health = healthOf(inputs, calls);

		assert.equal(health?.relatedAreaCount, 2);
		assert.equal(health?.status, "available");
		assert.deepEqual(calls, { codes: 1, relationships: 0 });
	}
});
