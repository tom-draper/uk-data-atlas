import assert from "node:assert/strict";
import test from "node:test";
import type { CrosswalkArtifact } from "../src/crosswalkInventory";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
} from "./routeFixtures";

test("translates codes only through a crosswalk valid for the requested purpose", () => {
	const response = route(
		"GET",
		"/v1/translations?sourceGeography=constituency&sourceRelease=2010&code=E14000001&targetGeography=constituency&targetRelease=2024-07-uk-bgc&purpose=identity",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual(
		(data as { paths: Array<{ id: string; origin: string }> }).paths,
		[
			{
				id: "constituency-2010-to-2024/forward/identity",
				purpose: "identity",
				from: { geography: "constituency", boundaryRelease: "2010" },
				to: {
					geography: "constituency",
					boundaryRelease: "2024-07-uk-bgc",
				},
				quality: "publisher-supplied",
				origin: "crosswalk",
				steps: [
					{
						crosswalkId: "constituency-2010-to-2024",
						direction: "forward",
						method: "official-lookup",
						purpose: "identity",
					},
				],
			},
		],
	);
	assert.deepEqual((data as { matches: unknown }).matches, [
		{
			crosswalk: {
				id: "constituency-2010-to-2024",
				method: "official-lookup",
				quality: "publisher-supplied",
				weighting: { status: "not-provided" },
				provenance: {
					input: "lookup.geojson",
					inputHash: "sha256:input",
				},
				direction: "forward",
			},
			source: { code: "E14000001", labels: ["Old seat"] },
			targets: [{ code: "E14001001", labels: ["New seat A"] }],
		},
	]);

	const unsupported = route(
		"GET",
		"/v1/translations?sourceGeography=constituency&sourceRelease=2010&code=E14000001&targetGeography=constituency&targetRelease=2024-07-uk-bgc&purpose=membership",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(unsupported.status, 422);
});

test("reverses published identity and containment crosswalks", () => {
	const identity = route(
		"GET",
		"/v1/translations?sourceGeography=constituency&sourceRelease=2024-07-uk-bgc&code=E14001001&targetGeography=constituency&targetRelease=2010&purpose=identity",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(identity.status, 200);
	assert.deepEqual(
		"data" in identity.body &&
			(identity.body.data as { matches: unknown }).matches,
		[
			{
				crosswalk: {
					id: "constituency-2010-to-2024",
					method: "official-lookup",
					quality: "publisher-supplied",
					weighting: { status: "not-provided" },
					provenance: {
						input: "lookup.geojson",
						inputHash: "sha256:input",
					},
					direction: "reverse",
				},
				source: { code: "E14001001", labels: ["New seat A"] },
				targets: [{ code: "E14000001", labels: ["Old seat"] }],
			},
		],
	);

	const membership = route(
		"GET",
		"/v1/translations?sourceGeography=localAuthority&sourceRelease=2025-01-uk-lad&code=E08000001&targetGeography=ward&targetRelease=2025-01-en-ward&purpose=membership",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(membership.status, 200);
	assert.deepEqual(
		"data" in membership.body &&
			(membership.body.data as { matches: unknown }).matches,
		[
			{
				crosswalk: {
					id: "ward-to-local-authority-2025",
					method: "clean-containment",
					quality: "publisher-supplied",
					weighting: { status: "not-applicable" },
					provenance: {
						input: "lookup.geojson",
						inputHash: "sha256:input",
					},
					direction: "reverse",
				},
				source: { code: "E08000001", labels: ["Greater Manchester"] },
				targets: [{ code: "E05000001", labels: ["Example ward"] }],
			},
		],
	);
});

test("normalises reverse area-overlap weights against the queried target", () => {
	const overlap: CrosswalkArtifact = {
		schemaVersion: 1,
		contentHash: "sha256:overlap",
		id: "constituency-to-local-authority-overlap",
		method: "area-overlap",
		quality: "derived",
		weighting: {
			status: "provided",
			basis: "area",
			normalisation: "per-source",
		},
		from: { geography: "constituency", boundaryRelease: "2024" },
		to: { geography: "localAuthority", boundaryRelease: "2025" },
		provenance: {
			inputs: [],
			areaProjection: "EPSG:6933",
			clipping: "none",
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
				from: { status: "not-available", reason: "Fixture." },
				to: { status: "not-available", reason: "Fixture." },
			},
			overlap: {
				candidatePairCount: 2,
				intersectingPairCount: 2,
				sliverPairCount: 0,
				sliverWidthM: 100,
				widestSliverWidthM: null,
				narrowestOverlapWidthM: 200,
				minimumCoverage: 0.99,
				minimumSourceCoverage: 1,
				minimumTargetCoverage: 1,
			},
		},
		records: [
			{
				source: {
					code: "E14000001",
					labels: ["First seat"],
					areaM2: 400,
					coverage: 1,
				},
				targets: [
					{
						code: "E08000001",
						labels: ["Example authority"],
						weight: 1,
						overlapAreaM2: 400,
						sourceShare: 1,
						targetShare: 0.4,
					},
				],
			},
			{
				source: {
					code: "E14000002",
					labels: ["Second seat"],
					areaM2: 600,
					coverage: 1,
				},
				targets: [
					{
						code: "E08000001",
						labels: ["Example authority"],
						weight: 1,
						overlapAreaM2: 600,
						sourceShare: 1,
						targetShare: 0.6,
					},
				],
			},
		],
	};
	const response = route(
		"GET",
		"/v1/translations?sourceGeography=localAuthority&sourceRelease=2025&code=E08000001&targetGeography=constituency&targetRelease=2024&purpose=apportion",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		new Map([...crosswalkLookup, [overlap.id, overlap]]),
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual(
		(data as { matches: Array<{ sourceCoverage: number }> }).matches[0]
			.sourceCoverage,
		1,
	);
	assert.deepEqual(
		(data as { matches: Array<{ targets: unknown }> }).matches[0].targets,
		[
			{
				code: "E14000001",
				labels: ["First seat"],
				areaM2: 400,
				coverage: 1,
				weight: 0.4,
				overlapAreaM2: 400,
				sourceShare: 0.4,
				targetShare: 1,
			},
			{
				code: "E14000002",
				labels: ["Second seat"],
				areaM2: 600,
				coverage: 1,
				weight: 0.6,
				overlapAreaM2: 600,
				sourceShare: 0.6,
				targetShare: 1,
			},
		],
	);
});
