import assert from "node:assert/strict";
import test from "node:test";
import type { AreaLookup, AreaRecord } from "../src/areaInventory";
import type { CrosswalkArtifact } from "../src/crosswalkInventory";
import type { RelationshipPath } from "../src/relationshipPaths";
import {
	assessPathTrust,
	buildConversionReach,
	capabilityStatus,
	planConversion,
	rankResolvedPaths,
	type RelationshipPrerequisite,
	type ResolvedRelationshipCapability,
	type ResolvedRelationshipPath,
} from "../src/resolver/conversionCapability";
import { compareBoundaryReleases } from "../src/resolver/releaseComparison";

type Candidate = Omit<ResolvedRelationshipPath, "rank">;
type Coverage = Candidate["coverage"]["status"];

const endpoint = (geography: string, boundaryRelease = "2025") => ({
	geography,
	boundaryRelease,
});

const relationshipPath = (
	id: string,
	overrides: Partial<RelationshipPath> = {},
): RelationshipPath => ({
	id,
	purpose: "membership",
	from: endpoint("ward"),
	to: endpoint("localAuthority"),
	quality: "publisher-supplied",
	origin: "declared",
	steps: [
		{
			crosswalkId: `${id}-step`,
			direction: "forward",
			method: "official-lookup",
			purpose: "membership",
		},
	],
	...overrides,
});

const candidate = (
	id: string,
	coverage: Coverage,
	overrides: Partial<RelationshipPath> = {},
): Candidate => {
	const path = relationshipPath(id, overrides);
	return {
		...path,
		operations: {
			permitted: ["membership-join"],
			prohibited: [],
			note: "",
		},
		trust: assessPathTrust(path, coverage),
		coverage: { status: coverage, steps: [] },
	};
};

const notBuilt: RelationshipPrerequisite = {
	id: "crosswalk-artifact",
	status: "not-built",
	reason: "The crosswalk artifact ward-la required by ward-la-path is not built.",
};

test("caps trust by coverage before considering how a path was declared", () => {
	const discoveredDerived = relationshipPath("p", {
		origin: "discovered",
		quality: "derived",
	});

	assert.equal(
		assessPathTrust(discoveredDerived, "not-built").level,
		"not-built",
	);
	assert.equal(
		assessPathTrust(discoveredDerived, "partial").level,
		"partial",
	);
	assert.deepEqual(assessPathTrust(discoveredDerived, "complete"), {
		level: "derived",
		reasons: [
			"The build's path search composed this path under its composition rules; no one has reviewed it.",
			"At least one path step is derived rather than publisher-supplied.",
		],
	});
	assert.equal(
		assessPathTrust(
			relationshipPath("p", { quality: "derived" }),
			"complete",
		).level,
		"derived",
	);
	assert.equal(
		assessPathTrust(relationshipPath("p"), "complete").level,
		"verified",
	);
});

test("ranks by coverage, then trust, origin and length, and explains each rank", () => {
	const twoSteps = relationshipPath("x").steps.concat(
		relationshipPath("y").steps,
	);
	const ranked = rankResolvedPaths([
		candidate("partial", "partial", { origin: "crosswalk" }),
		candidate("derived", "complete", { quality: "derived" }),
		candidate("declared-long", "complete", { steps: twoSteps }),
		candidate("crosswalk", "complete", { origin: "crosswalk" }),
		candidate("declared", "complete"),
		candidate("missing", "not-built"),
	]);

	assert.deepEqual(
		ranked.map((path) => [path.id, path.rank.position]),
		[
			["crosswalk", 1],
			["declared", 2],
			["declared-long", 3],
			["derived", 4],
			["partial", 5],
			["missing", 6],
		],
	);
	assert.deepEqual(ranked[2]!.rank.reasons, [
		"complete source coverage",
		"verified evidence",
		"declared path",
		"2 steps",
	]);
});

test("takes the capability status from the best path, or from what is missing", () => {
	const covered = (status: Coverage) => ({ coverage: { status, steps: [] } });

	assert.equal(
		capabilityStatus([covered("partial"), covered("complete")], []),
		"available",
	);
	assert.equal(
		capabilityStatus([covered("not-built"), covered("partial")], []),
		"partial",
	);
	assert.equal(
		capabilityStatus([covered("not-built")], [notBuilt]),
		"not-built",
	);
	assert.equal(capabilityStatus([], [notBuilt]), "not-built");
	assert.equal(
		capabilityStatus(
			[],
			[{ ...notBuilt, id: "relationship-path", status: "unsupported" }],
		),
		"unsupported",
	);
});

test("plans the first ranked path and keeps the rest as alternatives", () => {
	const paths = rankResolvedPaths([
		candidate("second", "complete", { origin: "discovered" }),
		candidate("first", "complete"),
	]);
	const plan = planConversion(
		{ status: "available", paths, missingPrerequisites: [] },
		"membership",
	);

	assert.equal(plan.status, "available");
	assert.equal(plan.selectedPath?.id, "first");
	assert.deepEqual(
		plan.alternatives.map((path) => path.id),
		["second"],
	);
	assert.equal(plan.reason, undefined);
});

test("explains an incomplete plan with its first missing prerequisite", () => {
	const capability: ResolvedRelationshipCapability = {
		status: "not-built",
		paths: rankResolvedPaths([candidate("missing", "not-built")]),
		missingPrerequisites: [notBuilt],
	};

	assert.equal(
		planConversion(capability, "membership").reason,
		notBuilt.reason,
	);
});

test("falls back to a generic reason only when nothing specific is missing", () => {
	const partial: ResolvedRelationshipCapability = {
		status: "partial",
		paths: rankResolvedPaths([candidate("partial", "partial")]),
		missingPrerequisites: [],
	};

	assert.equal(
		planConversion(partial, "membership").reason,
		"The best published path does not cover every source area.",
	);
	assert.equal(
		planConversion(
			{ status: "unsupported", paths: [], missingPrerequisites: [] },
			"membership",
		).reason,
		"No published conversion path can satisfy this request.",
	);
});

test("refuses an operation the selected path does not permit", () => {
	const plan = planConversion(
		{
			status: "available",
			paths: rankResolvedPaths([candidate("path", "complete")]),
			missingPrerequisites: [],
		},
		"membership",
		"weighted-allocation",
	);

	assert.equal(plan.status, "unsupported");
	assert.equal(plan.operation, "weighted-allocation");
	assert.match(plan.reason!, /not permitted/);
});

test("separates reaching new geographies from joining a geography's own vintages", () => {
	const reach = buildConversionReach([
		[relationshipPath("ward-la")],
		[
			relationshipPath("ward-vintage", {
				from: endpoint("ward", "2024"),
				to: endpoint("ward", "2025"),
			}),
		],
		[
			relationshipPath("lsoa-vintage", {
				from: endpoint("lsoa", "2011"),
				to: endpoint("lsoa", "2021"),
			}),
		],
	]);

	assert.deepEqual(reach.get("ward/2025"), {
		status: "connected",
		reaches: ["localAuthority"],
		reachedFrom: [],
		vintagePathCount: 1,
	});
	assert.equal(reach.get("localAuthority/2025")?.status, "connected");
	assert.deepEqual(reach.get("localAuthority/2025")?.reachedFrom, ["ward"]);
	assert.equal(reach.get("lsoa/2011")?.status, "vintage-only");
	assert.equal(reach.has("region/2025"), false);
});

const areas = (...codes: string[]): Map<string, AreaRecord> =>
	new Map(codes.map((code) => [code, { code, name: `${code} name` }]));

const validation = {
	sourceNameConflicts: [],
	endpoints: {
		from: { status: "not-available", reason: "Fixture." },
		to: { status: "not-available", reason: "Fixture." },
	},
};

test("compares code sets, published continuity and mapping cardinality between releases", () => {
	const areaLookup: AreaLookup = new Map([
		["ward/2024", areas("W1", "W2", "W3", "W4", "OLD")],
		["ward/2025", areas("W1", "W2", "W3", "W4", "NEW1", "NEW2")],
	]);
	const continuity = {
		schemaVersion: 1,
		contentHash: "sha256:continuity",
		id: "ward-2024-2025-continuity",
		method: "same-code-continuity",
		quality: "derived",
		relationshipPurpose: "identity",
		weighting: { status: "not-applicable" },
		from: endpoint("ward", "2024"),
		to: endpoint("ward", "2025"),
		provenance: { inputs: [] },
		validation: {
			...validation,
			continuity: {
				changedExtent: [
					{
						code: "W2",
						relation: "changed",
						widestDifferenceM: 40,
						sourceShare: 0.9,
						targetShare: 0.8,
					},
					{
						code: "W3",
						relation: "indeterminate",
						widestDifferenceM: 2,
						sourceShare: 0.99,
						targetShare: 0.99,
					},
				],
				unmeasured: [],
			},
		},
		records: [
			{
				source: { code: "W1", labels: [] },
				targets: [
					{
						code: "W1",
						labels: [],
						widestDifferenceM: 0,
						sourceShare: 1,
						targetShare: 1,
					},
				],
			},
		],
	} as unknown as CrosswalkArtifact;
	// Published from the later release, so the comparison views it in reverse.
	const lookup = {
		schemaVersion: 1,
		contentHash: "sha256:lookup",
		id: "ward-2025-2024-lookup",
		method: "official-lookup",
		quality: "publisher-supplied",
		weighting: { status: "not-provided" },
		from: endpoint("ward", "2025"),
		to: endpoint("ward", "2024"),
		provenance: { input: "lookup.csv", inputHash: "sha256:lookup-input" },
		validation,
		records: [
			{
				source: { code: "NEW1", labels: [] },
				targets: [{ code: "OLD", labels: [] }],
			},
			{
				source: { code: "NEW2", labels: [] },
				targets: [{ code: "OLD", labels: [] }],
			},
		],
	} as unknown as CrosswalkArtifact;
	const comparison = compareBoundaryReleases(
		{
			areaLookup,
			crosswalkLookup: new Map([
				[continuity.id, continuity],
				[lookup.id, lookup],
			]),
		},
		"ward",
		"2024",
		"2025",
	)!;

	assert.deepEqual(comparison.summary, {
		fromAreaCount: 5,
		toAreaCount: 6,
		sharedCodeCount: 4,
		codesOnlyInFromCount: 1,
		codesOnlyInToCount: 2,
		continuousCodeCount: 1,
		changedExtentCount: 1,
		indeterminateExtentCount: 1,
		unmeasuredCodeCount: 0,
		unassessedSharedCodeCount: 1,
		publishedRelationshipCount: 1,
	});
	assert.deepEqual(
		comparison.codes.onlyInFrom.map((area) => area.id),
		["ward/2024/OLD"],
	);
	assert.equal(comparison.continuity.status, "available");
	if (comparison.continuity.status === "available") {
		assert.deepEqual(comparison.continuity.unassessedSharedCodes, ["W4"]);
		assert.deepEqual(
			comparison.continuity.changedExtent.map(({ code }) => code),
			["W2", "W3"],
		);
	}
	const [published] = comparison.publishedRelationships;
	assert.equal(published!.direction, "reverse");
	assert.equal(published!.mapping.shape, "one-to-many");
	assert.deepEqual(published!.mapping.examples.oneToMany, [
		{ fromCode: "OLD", toCodes: ["NEW1", "NEW2"] },
	]);
});

test("does not compare a release that has not been compiled", () => {
	assert.equal(
		compareBoundaryReleases(
			{ areaLookup: new Map([["ward/2024", areas("W1")]]) },
			"ward",
			"2024",
			"2025",
		),
		undefined,
	);
});
