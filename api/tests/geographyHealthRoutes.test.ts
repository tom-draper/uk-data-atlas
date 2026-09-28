import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import type {
	CrosswalkInventory,
	PropertyCrosswalkArtifact,
} from "../src/crosswalkInventory";
import { createGeographyResolver } from "../src/geographyResolver";
import {
	compileRelationshipPaths,
	createRelationshipPathIndex,
} from "../src/relationshipPaths";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
	crosswalkLookup,
} from "./routeFixtures";

test("summarises relationship gaps across compiled releases", () => {
	const response = route(
		"GET",
		"/v1/geography-health",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.deepEqual(data.summary, { partial: 1, available: 1 });
	assert.equal(
		data.releases.find((release: any) => release.geography === "ward")
			.gapCount,
		1,
	);
});

test("keeps identity coverage visible when relationship artifacts are not built", () => {
	const health = createGeographyResolver({ areaLookup }).geographyHealth();
	assert.deepEqual(
		health.find((release) => release.geography === "ward"),
		{
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			status: "not-built",
			areaCount: 2,
			relatedAreaCount: 0,
			gapCount: 2,
			countries: [],
			reach: {
				status: "isolated",
				reaches: [],
				reachedFrom: [],
				vintagePathCount: 0,
			},
		},
	);
});

test("filters the repair dashboard to one geography", () => {
	const response = route(
		"GET",
		"/v1/geography-health?geography=ward",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	const data = (response.body as { data: any }).data;
	assert.equal(data.releases.length, 1);
	assert.equal(data.filters.geography, "ward");
	assert.equal(data.priorities[0].geography, "ward");
	assert.equal(
		data.priorities[0].href,
		"/v1/relationship-coverage?geography=ward&release=2025-01-en-ward",
	);
});

test("filters release health by boundary country coverage", () => {
	const response = route(
		"GET",
		"/v1/geography-health?country=GB-SCT",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	const data = (response.body as { data: any }).data;
	assert.deepEqual(data.releases, []);
	assert.equal(data.filters.country, "GB-SCT");
});

// A release can have a relationship on every area and still convert onto
// nothing a caller can use, so reach answers a separate question: whether a
// published path leaves this release for another geography at all.
test("separates having relationships from being able to carry data", () => {
	const wards = (boundaryRelease: string, contentHash: string) => ({
		schemaVersion: 1 as const,
		contentHash,
		geography: "ward",
		boundaryRelease,
		codeProperty: "WD25CD",
		nameProperty: "WD25NM",
		areas: [{ code: "E05000001", name: "Example ward" }],
	});
	const lookup = createAreaLookup([
		wards("2025-01-en-ward", "sha256:wards-2025"),
		wards("2024-01-en-ward", "sha256:wards-2024"),
		{
			schemaVersion: 1,
			contentHash: "sha256:lad",
			geography: "localAuthority",
			boundaryRelease: "2025-01-uk-lad",
			codeProperty: "LAD25CD",
			nameProperty: "LAD25NM",
			areas: [{ code: "E08000001", name: "Greater Manchester" }],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:seats",
			geography: "constituency",
			boundaryRelease: "2024-07-uk-bgc",
			codeProperty: "PCON24CD",
			nameProperty: "PCON24NM",
			areas: [
				{ code: "E14000001", name: "A seat no crosswalk mentions" },
			],
		},
	]);
	// One crosswalk leaves the ward release for another geography; the other
	// only links it to an earlier vintage of itself.
	const continuity: PropertyCrosswalkArtifact = {
		...containmentCrosswalk,
		id: "ward-2024-to-2025",
		contentHash: "sha256:ward-continuity",
		method: "official-lookup",
		from: { geography: "ward", boundaryRelease: "2024-01-en-ward" },
		to: { geography: "ward", boundaryRelease: "2025-01-en-ward" },
	};
	const artifacts = [containmentCrosswalk, continuity];
	const inventory: CrosswalkInventory = {
		schemaVersion: 1,
		contentHash: "sha256:crosswalks",
		crosswalks: artifacts.map((artifact) => ({
			id: artifact.id,
			from: artifact.from,
			to: artifact.to,
			method: artifact.method,
			quality: artifact.quality,
			weighting: artifact.weighting,
			recordCount: artifact.records.length,
			artifact: `crosswalks/${artifact.id}.json`,
			contentHash: artifact.contentHash,
		})),
	};
	const health = createGeographyResolver({
		areaLookup: lookup,
		crosswalkInventory: inventory,
		crosswalkLookup: new Map(
			artifacts.map((artifact) => [artifact.id, artifact]),
		),
		relationshipPathIndex: createRelationshipPathIndex(
			compileRelationshipPaths(inventory),
		),
	}).geographyHealth();
	const reachOf = (geography: string, boundaryRelease: string) =>
		health.find(
			(release) =>
				release.geography === geography &&
				release.boundaryRelease === boundaryRelease,
		)?.reach;
	assert.deepEqual(reachOf("ward", "2025-01-en-ward"), {
		status: "connected",
		reaches: ["localAuthority"],
		reachedFrom: ["localAuthority"],
		vintagePathCount: 2,
	});
	assert.deepEqual(reachOf("localAuthority", "2025-01-uk-lad")?.reachedFrom, [
		"ward",
	]);
	// The 2024 wards are joined to their own successor and nothing else, so
	// every area has a relationship yet no data can be carried off the release.
	assert.deepEqual(reachOf("ward", "2024-01-en-ward"), {
		status: "vintage-only",
		reaches: [],
		reachedFrom: [],
		vintagePathCount: 2,
	});
	assert.equal(reachOf("constituency", "2024-07-uk-bgc")?.status, "isolated");
});

test("ranks and filters by what a release can convert onto", () => {
	// No path inventory is built here, so nothing converts anywhere and the
	// whole dashboard is isolated.
	const response = route(
		"GET",
		"/v1/geography-health?reach=isolated",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.releases.length, 2);
	assert.ok(
		data.releases.every(
			(release: any) => release.reach.status === "isolated",
		),
	);
	assert.equal(data.reachSummary.isolated, 2);
	assert.equal(data.filters.reach, "isolated");
	assert.equal(
		route(
			"GET",
			"/v1/geography-health?reach=nowhere",
			registry,
			geographyInventory,
			areaLookup,
			crosswalkInventory,
			crosswalkLookup,
		).status,
		400,
	);
});
