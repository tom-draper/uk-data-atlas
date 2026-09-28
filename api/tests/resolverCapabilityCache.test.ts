import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { CapabilityResolver } from "../src/resolver/capability";
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
