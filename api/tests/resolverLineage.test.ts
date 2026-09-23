import assert from "node:assert/strict";
import test from "node:test";
import type { CrosswalkArtifact, PropertyCrosswalkArtifact } from "../src/crosswalkInventory";
import { LineageResolver } from "../src/resolver/lineage";

const relation = (
	id: string,
	records: PropertyCrosswalkArtifact["records"],
): PropertyCrosswalkArtifact => ({
	schemaVersion: 1,
	contentHash: `sha256:${id}`,
	id,
	method: "clean-containment",
	quality: "publisher-supplied",
	weighting: { status: "not-applicable" },
	from: { geography: "ward", boundaryRelease: "2024" },
	to: { geography: "ward", boundaryRelease: "2024" },
	provenance: { input: `${id}.csv`, inputHash: `sha256:${id}-input` },
	validation: {
		sourceNameConflicts: [],
		endpoints: {
			from: { status: "verified", availableAreaCount: 1, referencedCodeCount: 1 },
			to: { status: "verified", availableAreaCount: 1, referencedCodeCount: 1 },
		},
	},
	records,
});

const record = (source: string, target: string) => ({
	source: { code: source, labels: [source] },
	targets: [{ code: target, labels: [target] }],
});

test("LineageResolver reports each edge once at its shortest depth", () => {
	const crosswalks: CrosswalkArtifact[] = [
		relation("origin-a", [record("O", "A")]),
		relation("origin-z", [record("O", "Z")]),
		relation("a-z", [record("A", "Z")]),
		// Duplicate source-target records still describe one published edge.
		relation("z-parent", [record("Z", "P"), record("Z", "P")]),
	];
	const resolver = new LineageResolver(
		new Map(crosswalks.map((crosswalk) => [crosswalk.id, crosswalk])),
		(identity) => ({ code: identity.code, name: identity.code }),
		() => [],
	);
	const lineage = resolver.ancestorLineage(
		{ geography: "ward", boundaryRelease: "2024", code: "O" },
		5,
	);
	const zParent = lineage.filter(
		(edge) => edge.crosswalk.id === "z-parent",
	);

	assert.equal(zParent.length, 1);
	assert.equal(zParent[0]?.from, "ward/2024/Z");
	assert.equal(zParent[0]?.counterpart.id, "ward/2024/P");
	assert.equal(zParent[0]?.depth, 2);
	assert.equal(
		lineage.find((edge) => edge.crosswalk.id === "a-z")?.depth,
		2,
	);
	assert.deepEqual(
		resolver
			.ancestorLineage(
				{ geography: "ward", boundaryRelease: "2024", code: "O" },
				1,
			)
			.map((edge) => edge.crosswalk.id),
		["origin-a", "origin-z"],
	);
});

test("LineageResolver returns no relationships when no graph is loaded", () => {
	const resolver = new LineageResolver(undefined, () => undefined, () => []);
	const identity = { geography: "ward", boundaryRelease: "2024", code: "O" };

	assert.equal(resolver.hasAreaRelationships(), false);
	assert.deepEqual(resolver.ancestorLineage(identity, 5), []);
	assert.equal(resolver.areaHistory(identity), undefined);
});

test("LineageResolver keeps only succession in an area's history", () => {
	// W1 replaced W0 across releases, and sits within L1 in its own release.
	const succession: PropertyCrosswalkArtifact = {
		...relation("ward-2020-to-2024", [record("W0", "W1")]),
		method: "official-lookup",
		from: { geography: "ward", boundaryRelease: "2020" },
		to: { geography: "ward", boundaryRelease: "2024" },
	};
	const containment: PropertyCrosswalkArtifact = {
		...relation("ward-to-authority", [record("W1", "L1")]),
		to: { geography: "localAuthority", boundaryRelease: "2024" },
	};
	const sameCodeReleases = [
		{
			id: "ward/2022/W1",
			geography: "ward",
			boundaryRelease: "2022",
			code: "W1",
			name: "W1",
			status: "same-code-continuity" as const,
		},
	];
	const resolver = new LineageResolver(
		new Map(
			[succession, containment].map((crosswalk) => [crosswalk.id, crosswalk]),
		),
		(identity) => ({ code: identity.code, name: identity.code }),
		() => sameCodeReleases,
	);
	const history = resolver.areaHistory({
		geography: "ward",
		boundaryRelease: "2024",
		code: "W1",
	})!;

	assert.deepEqual(
		history.relationships.map(({ crosswalk, counterpart }) => [
			crosswalk.id,
			counterpart.id,
		]),
		[["ward-2020-to-2024", "ward/2020/W0"]],
	);
	assert.ok(
		history.relationships.every(({ relation: kind }) =>
			kind === "successor" || kind === "predecessor",
		),
	);
	assert.deepEqual(
		history.lineage.map(({ crosswalk, depth }) => [crosswalk.id, depth]),
		[["ward-2020-to-2024", 1]],
	);
	assert.equal(history.sameCodeReleases, sameCodeReleases);

	// The containment the history left out is the authority's descendant.
	assert.deepEqual(
		resolver
			.descendantLineage(
				{ geography: "localAuthority", boundaryRelease: "2024", code: "L1" },
				3,
			)
			.map(({ crosswalk, counterpart }) => [crosswalk.id, counterpart.id]),
		[["ward-to-authority", "ward/2024/W1"]],
	);
});
