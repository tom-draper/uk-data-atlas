import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { route, type CrosswalkLookup } from "../src/routes";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import type { CrosswalkArtifact, CrosswalkInventory } from "../src/crosswalkInventory";
import type { GeographyInventory } from "../src/geographyInventory";

const registry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: [
		{
			id: "2025-01-en-ward",
			geography: "ward",
			title: "Ward boundaries",
			coverage: { countries: ["GB-ENG"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/source",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: "sha256:metadata",
		},
	],
};

const geographyInventory: GeographyInventory = {
	schemaVersion: 1,
	contentHash: "sha256:geography",
	boundaryRegistryHash: "sha256:registry",
	releases: [],
	geographies: [],
};

const areaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:areas",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		codeProperty: "WD25CD",
		nameProperty: "WD25NM",
		areas: [{ code: "E05000001", name: "Example ward" }],
	},
]);

const crosswalkArtifact: CrosswalkArtifact = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalk-artifact",
	id: "constituency-2010-to-2024",
	method: "official-lookup",
	quality: "publisher-supplied",
	weighting: { status: "not-provided" },
	from: { geography: "constituency", boundaryRelease: "2010" },
	to: { geography: "constituency", boundaryRelease: "2024-07-uk-bgc" },
	provenance: { input: "lookup.geojson", inputHash: "sha256:input" },
	validation: { sourceNameConflicts: [] },
	records: [
		{
			source: { code: "E14000001", labels: ["Old seat"] },
			targets: [{ code: "E14001001", labels: ["New seat A"] }],
		},
	],
};

const crosswalkInventory: CrosswalkInventory = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalk-inventory",
	crosswalks: [
		{
			id: crosswalkArtifact.id,
			from: crosswalkArtifact.from,
			to: crosswalkArtifact.to,
			method: crosswalkArtifact.method,
			quality: crosswalkArtifact.quality,
			weighting: crosswalkArtifact.weighting,
			recordCount: crosswalkArtifact.records.length,
			artifact: `crosswalks/${crosswalkArtifact.id}.json`,
			contentHash: crosswalkArtifact.contentHash,
		},
	],
};

const crosswalkLookup: CrosswalkLookup = new Map([
	[crosswalkArtifact.id, crosswalkArtifact],
]);

test("lists published geographies", () => {
	const response = route("GET", "/v1/geographies", registry);
	assert.equal(response.status, 200);
	assert.deepEqual(response.body, {
		apiVersion: "v1",
		atlasRelease: "sha256:registry",
		data: [
			{ id: "ward", latestRelease: "2025-01-en-ward", releaseCount: 1 },
		],
		meta: { nextCursor: null },
	});
});

test("gets one boundary release", () => {
	const response = route(
		"GET",
		"/v1/boundary-releases/ward/2025-01-en-ward",
		registry,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body && response.body.data,
		registry.releases[0],
	);
});

test("publishes the geography compiler coverage", () => {
	const response = route(
		"GET",
		"/v1/geography-inventory",
		registry,
		geographyInventory,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body && response.body.data,
		geographyInventory,
	);
});

test("gets a compiled area by its full identity", () => {
	const response = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual("data" in response.body && response.body.data, {
		id: "ward/2025-01-en-ward/E05000001",
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		code: "E05000001",
		name: "Example ward",
	});
});

test("lists published crosswalks", () => {
	const response = route(
		"GET",
		"/v1/crosswalks",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		crosswalkInventory.crosswalks,
	);
});

test("gets one crosswalk's metadata without its full record set", () => {
	const response = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && !("records" in (data as object)));
	assert.deepEqual(data, {
		schemaVersion: 1,
		contentHash: "sha256:crosswalk-artifact",
		id: "constituency-2010-to-2024",
		method: "official-lookup",
		quality: "publisher-supplied",
		weighting: { status: "not-provided" },
		from: { geography: "constituency", boundaryRelease: "2010" },
		to: { geography: "constituency", boundaryRelease: "2024-07-uk-bgc" },
		provenance: { input: "lookup.geojson", inputHash: "sha256:input" },
		validation: { sourceNameConflicts: [] },
	});

	const missing = route(
		"GET",
		"/v1/crosswalks/unknown",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(missing.status, 404);
});

test("filters crosswalk records by source code", () => {
	const response = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024/records?source=E14000001",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body && response.body.data,
		crosswalkArtifact.records,
	);

	const unfiltered = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024/records",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.deepEqual(
		"data" in unfiltered.body && unfiltered.body.data,
		crosswalkArtifact.records,
	);

	const noMatch = route(
		"GET",
		"/v1/crosswalks/constituency-2010-to-2024/records?source=unknown",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
	);
	assert.deepEqual(
		"data" in noMatch.body && noMatch.body.data,
		[],
	);
});

test("uses problem details for missing resources and unsupported methods", () => {
	const missing = route(
		"GET",
		"/v1/boundary-releases/ward/unknown",
		registry,
	);
	assert.equal(missing.status, 404);
	assert.equal("title" in missing.body && missing.body.title, "Not Found");

	const write = route("POST", "/v1/geographies", registry);
	assert.equal(write.status, 405);
	assert.equal(
		"title" in write.body && write.body.title,
		"Method Not Allowed",
	);
});
