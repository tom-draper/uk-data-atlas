import assert from "node:assert/strict";
import test from "node:test";
import type { CrosswalkLookup } from "../src/routing";
import type { CrosswalkArtifact } from "../src/crosswalkInventory";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	crosswalkArtifact,
	crosswalkInventory,
	crosswalkLookup,
} from "./routeFixtures";

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
		validation: crosswalkArtifact.validation,
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
	assert.deepEqual("data" in noMatch.body && noMatch.body.data, []);
});

test("paginates crosswalk records with opaque cursors", () => {
	const pagedCrosswalk: CrosswalkArtifact = {
		...crosswalkArtifact,
		id: "paged-crosswalk",
		records: [
			...crosswalkArtifact.records,
			{
				source: { code: "E14000002", labels: ["Other old seat"] },
				targets: [{ code: "E14001002", labels: ["Other new seat"] }],
			},
		],
	};
	const pagedLookup: CrosswalkLookup = new Map([
		[pagedCrosswalk.id, pagedCrosswalk],
	]);
	const first = route(
		"GET",
		"/v1/crosswalks/paged-crosswalk/records?limit=1",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		pagedLookup,
	);
	assert.equal(first.status, 200);
	assert.deepEqual("data" in first.body && first.body.data, [
		pagedCrosswalk.records[0],
	]);
	const cursor = "meta" in first.body ? first.body.meta.nextCursor : null;
	assert.equal(typeof cursor, "string");
	assert.ok(cursor);

	const second = route(
		"GET",
		`/v1/crosswalks/paged-crosswalk/records?limit=1&cursor=${cursor}`,
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		pagedLookup,
	);
	assert.equal(second.status, 200);
	assert.deepEqual("data" in second.body && second.body.data, [
		pagedCrosswalk.records[1],
	]);
	assert.equal("meta" in second.body && second.body.meta.nextCursor, null);

	const invalid = route(
		"GET",
		"/v1/crosswalks/paged-crosswalk/records?limit=0",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		pagedLookup,
	);
	assert.equal(invalid.status, 400);
});
