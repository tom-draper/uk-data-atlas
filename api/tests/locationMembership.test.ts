import assert from "node:assert/strict";
import test from "node:test";
import {
	crosswalksTo,
	membersThroughCrosswalk,
	membershipKindFor,
} from "../src/locationMembership";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "../src/crosswalkInventory";

const containment = {
	schemaVersion: 1,
	contentHash: "sha256:containment",
	id: "ward-to-lad",
	method: "clean-containment",
	quality: "publisher-supplied",
	weighting: { status: "not-applicable" },
	from: { geography: "ward", boundaryRelease: "2023" },
	to: { geography: "localAuthority", boundaryRelease: "2023-lad" },
	provenance: { input: "lookup.geojson", inputHash: "sha256:input" },
	validation: { checks: [] },
	records: [
		{
			source: { code: "W1", labels: ["Ward one"] },
			targets: [{ code: "LA1", labels: ["Authority one"] }],
		},
		{
			source: { code: "W2", labels: ["Ward two"] },
			targets: [{ code: "LA1", labels: ["Authority one"] }],
		},
		{
			source: { code: "W3", labels: ["Ward three"] },
			targets: [{ code: "LA2", labels: ["Authority two"] }],
		},
	],
} as unknown as CrosswalkArtifact;

const overlapTarget = (
	code: string,
	weight: number,
): Record<string, unknown> => ({
	code,
	labels: [code],
	weight,
	overlapAreaM2: weight * 1000,
	sourceShare: weight,
	targetShare: weight,
});

const overlap = {
	schemaVersion: 1,
	contentHash: "sha256:overlap",
	id: "constituency-to-lad",
	method: "area-overlap",
	quality: "derived",
	weighting: {
		status: "provided",
		basis: "area",
		normalisation: "per-source",
	},
	from: { geography: "constituency", boundaryRelease: "2024" },
	to: { geography: "localAuthority", boundaryRelease: "2024-lad" },
	provenance: { input: "overlap.geojson", inputHash: "sha256:input" },
	validation: { checks: [] },
	records: [
		{
			// Wholly inside one member.
			source: {
				code: "C1",
				labels: ["Whole"],
				areaM2: 1000,
				coverage: 1,
			},
			targets: [overlapTarget("LA1", 1)],
		},
		{
			// Straddles the edge: part of it lies outside the location.
			source: {
				code: "C2",
				labels: ["Straddler"],
				areaM2: 1000,
				coverage: 1,
			},
			targets: [overlapTarget("LA1", 0.4), overlapTarget("LA9", 0.6)],
		},
		{
			// Split across two members of the same location: wholly inside it.
			source: {
				code: "C3",
				labels: ["Split"],
				areaM2: 1000,
				coverage: 1,
			},
			targets: [overlapTarget("LA1", 0.5), overlapTarget("LA2", 0.5)],
		},
		{
			// Nothing to do with this location.
			source: {
				code: "C4",
				labels: ["Elsewhere"],
				areaM2: 1000,
				coverage: 1,
			},
			targets: [overlapTarget("LA9", 1)],
		},
	],
} as unknown as CrosswalkArtifact;

test("names what membership through each method means", () => {
	assert.equal(membershipKindFor(containment), "fully-contained");
	assert.equal(membershipKindFor(overlap), "weighted-overlap");
});

test("finds the crosswalks that reach a geography from its parent", () => {
	const inventory = {
		schemaVersion: 1,
		contentHash: "sha256:inventory",
		crosswalks: [
			{
				id: "ward-to-lad",
				from: { geography: "ward", boundaryRelease: "2023" },
				to: {
					geography: "localAuthority",
					boundaryRelease: "2023-lad",
				},
			},
			{
				id: "ward-to-lad-other-release",
				from: { geography: "ward", boundaryRelease: "2016" },
				to: {
					geography: "localAuthority",
					boundaryRelease: "2016-lad",
				},
			},
			{
				id: "ward-to-region",
				from: { geography: "ward", boundaryRelease: "2023" },
				to: { geography: "region", boundaryRelease: "2023-region" },
			},
		],
	} as unknown as CrosswalkInventory;
	assert.deepEqual(
		crosswalksTo(inventory, "ward", "2023", "localAuthority").map(
			(candidate) => candidate.id,
		),
		["ward-to-lad"],
	);
	// A geography with no crosswalk to the parent finds nothing, which is what
	// lets the caller be told so rather than given an empty member list.
	assert.deepEqual(
		crosswalksTo(inventory, "parish", "2023", "localAuthority"),
		[],
	);
});

test("collects the areas contained by a location's members", () => {
	const members = membersThroughCrosswalk(
		containment,
		new Set(["LA1", "LA2"]),
	);
	assert.deepEqual(
		members.map((member) => member.code),
		["W1", "W2", "W3"],
	);
	assert.equal(members[0]!.throughCode, "LA1");
	assert.equal(members[2]!.throughCode, "LA2");
	// Containment has no share to report: the area is wholly inside.
	assert.equal(members[0]!.weight, undefined);
	assert.equal(members[0]!.partial, undefined);
});

test("leaves out areas contained by an authority outside the location", () => {
	const members = membersThroughCrosswalk(containment, new Set(["LA2"]));
	assert.deepEqual(
		members.map((member) => member.code),
		["W3"],
	);
});

test("marks an overlapping area partial and reports the share inside", () => {
	const members = membersThroughCrosswalk(overlap, new Set(["LA1", "LA2"]));
	const byCode = new Map(members.map((member) => [member.code, member]));
	assert.deepEqual([...byCode.keys()].sort(), ["C1", "C2", "C3"]);

	// Wholly inside one member.
	assert.equal(byCode.get("C1")!.weight, 1);
	assert.equal(byCode.get("C1")!.partial, undefined);

	// Straddles the edge: only the share inside is reported, and it is flagged.
	assert.equal(byCode.get("C2")!.weight, 0.4);
	assert.equal(byCode.get("C2")!.partial, true);

	// Split between two members of the same location, so wholly inside it: the
	// shares add to one and it is not partial.
	assert.equal(byCode.get("C3")!.weight, 1);
	assert.equal(byCode.get("C3")!.partial, undefined);

	// Belongs to an authority the location does not contain.
	assert.equal(byCode.has("C4"), false);
});

test("returns members in a stable order", () => {
	const members = membersThroughCrosswalk(overlap, new Set(["LA2", "LA1"]));
	assert.deepEqual(
		members.map((member) => member.code),
		[...members.map((member) => member.code)].sort(),
	);
});

test("finds nothing for a location no member of which appears", () => {
	assert.deepEqual(
		membersThroughCrosswalk(containment, new Set(["LA7"])),
		[],
	);
	assert.deepEqual(membersThroughCrosswalk(containment, new Set()), []);
});
