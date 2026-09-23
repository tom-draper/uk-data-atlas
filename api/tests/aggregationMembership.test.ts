import assert from "node:assert/strict";
import test from "node:test";
import {
	fullMembership,
	membershipThroughSteps,
	pathMembershipClaims,
} from "../src/aggregationMembership";
import type { CrosswalkArtifact } from "../src/crosswalkInventory";

/** Membership reads only the method, purpose and records of a crosswalk. */
const crosswalk = (
	id: string,
	records: Array<[string, string[]]>,
	overrides: Partial<CrosswalkArtifact> = {},
): CrosswalkArtifact =>
	({
		id,
		method: "clean-containment",
		records: records.map(([source, targets]) => ({
			source: { code: source, labels: [] },
			targets: targets.map((code) => ({ code, labels: [] })),
		})),
		...overrides,
	}) as CrosswalkArtifact;

// Wards W1 and W2 lie in L1, W3 in L2; L1 lies in region R1 and L2 in R2.
const wardToAuthority = crosswalk("ward-to-authority", [
	["W1", ["L1"]],
	["W2", ["L1"]],
	["W3", ["L2"]],
]);
const authorityToRegion = crosswalk("authority-to-region", [
	["L1", ["R1"]],
	["L2", ["R2"]],
]);

test("keeps a single crosswalk's membership as it was", () => {
	assert.deepEqual(fullMembership(wardToAuthority, "L1"), {
		memberCodes: ["W1", "W2"],
		unsafeSourceCount: 0,
	});
	const split = crosswalk("split", [["W1", ["L1", "L2"]]]);
	assert.deepEqual(fullMembership(split, "L1"), {
		memberCodes: [],
		unsafeSourceCount: 1,
	});
	assert.equal(
		fullMembership(
			crosswalk("identity", [["W1", ["L1"]]], {
				method: "official-lookup",
				relationshipPurpose: "identity",
			}),
			"L1",
		),
		undefined,
	);
});

test("counts an area-overlap source as a member only when wholly inside", () => {
	const overlap = {
		id: "overlap",
		method: "area-overlap",
		records: [
			{
				source: { code: "W1", labels: [], areaM2: 1, coverage: 1 },
				targets: [{ code: "L1", labels: [], weight: 1, overlapAreaM2: 1, sourceShare: 1, targetShare: 0.5 }],
			},
			{
				source: { code: "W2", labels: [], areaM2: 1, coverage: 0.98 },
				targets: [{ code: "L1", labels: [], weight: 1, overlapAreaM2: 1, sourceShare: 0.98, targetShare: 0.5 }],
			},
		],
	} as unknown as CrosswalkArtifact;

	assert.deepEqual(fullMembership(overlap, "L1"), {
		memberCodes: ["W1"],
		unsafeSourceCount: 1,
	});
});

test("composes membership through every step of a path", () => {
	assert.deepEqual(
		membershipThroughSteps([wardToAuthority, authorityToRegion], "R1"),
		{ memberCodes: ["W1", "W2"], unsafeSourceCount: 0 },
	);
	assert.deepEqual(
		membershipThroughSteps([wardToAuthority, authorityToRegion], "R2"),
		{ memberCodes: ["W3"], unsafeSourceCount: 0 },
	);
});

test("treats a source split at any step as unsafe for every target it reaches", () => {
	// L1 is split across both regions at the second step.
	const splitRegions = crosswalk("split-regions", [
		["L1", ["R1", "R2"]],
		["L2", ["R2"]],
	]);

	assert.deepEqual(
		membershipThroughSteps([wardToAuthority, splitRegions], "R1"),
		{ memberCodes: [], unsafeSourceCount: 2 },
	);
	assert.deepEqual(
		membershipThroughSteps([wardToAuthority, splitRegions], "R2"),
		{ memberCodes: ["W3"], unsafeSourceCount: 2 },
	);
});

test("leaves out a source whose area a later step does not carry", () => {
	const partial = crosswalk("partial", [["L1", ["R1"]]]);

	assert.deepEqual(membershipThroughSteps([wardToAuthority, partial], "R1"), {
		memberCodes: ["W1", "W2"],
		unsafeSourceCount: 0,
	});
});

test("names why each path step establishes membership, or the first that does not", () => {
	const continuity = crosswalk("ward-continuity", [["W1", ["W1"]]], {
		method: "same-code-continuity",
	});
	const identity = crosswalk("ward-lookup", [["W1", ["W9"]]], {
		method: "official-lookup",
		relationshipPurpose: "identity",
	});

	assert.deepEqual(
		pathMembershipClaims([
			{ artifact: continuity, direction: "forward" },
			{ artifact: wardToAuthority, direction: "forward" },
		]),
		{
			claims: [
				"verified-same-code-continuity",
				"verified-clean-containment",
			],
		},
	);
	assert.match(
		(
			pathMembershipClaims([
				{ artifact: identity, direction: "forward" },
			]) as { refusal: string }
		).refusal,
		/Step 1 of the path, the official-lookup crosswalk ward-lookup, does not declare membership/,
	);
	assert.match(
		(
			pathMembershipClaims([
				{ artifact: wardToAuthority, direction: "forward" },
				{ artifact: authorityToRegion, direction: "reverse" },
			]) as { refusal: string }
		).refusal,
		/Step 2 of the path runs authority-to-region in reverse/,
	);
});
