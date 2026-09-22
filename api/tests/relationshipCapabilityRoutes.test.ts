import assert from "node:assert/strict";
import test from "node:test";
import { createGeographyResolver } from "../src/geographyResolver";
import { compileRelationshipPaths, createRelationshipPathIndex } from "../src/relationshipPaths";
import { route } from "../src/routes";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
} from "./geographyFixtures";
import { registry } from "./routeFixtures";

const relationshipPathInventory = compileRelationshipPaths(crosswalkInventory);

const contextFor = ({
	lookup = areaLookup,
	crosswalks = new Map([[containmentCrosswalk.id, containmentCrosswalk]]),
}: {
	lookup?: typeof areaLookup;
	crosswalks?: Map<string, typeof containmentCrosswalk>;
} = {}) => ({
	boundaryRegistry: registry,
	areaLookup: lookup,
	crosswalkInventory,
	crosswalkLookup: crosswalks,
	relationshipPathInventory,
	geographyResolver: createGeographyResolver({
		boundaryRegistry: registry,
		areaLookup: lookup,
		crosswalkInventory,
		crosswalkLookup: crosswalks,
		relationshipPathIndex: createRelationshipPathIndex(
			relationshipPathInventory,
		),
	}),
});

const query =
	"/v1/relationship-capabilities?sourceGeography=ward&sourceRelease=2025-01-en-ward&targetGeography=localAuthority&targetRelease=2025-01-uk-lad&purpose=membership";

test("discovers every declared conversion from one source release", () => {
	const response = route(
		"GET",
		"/v1/relationship-capabilities?sourceGeography=ward&sourceRelease=2025-01-en-ward",
		contextFor(),
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "available");
	assert.equal(data.capabilities.length, 1);
	assert.deepEqual(data.capabilities[0].to, {
		geography: "localAuthority",
		boundaryRelease: "2025-01-uk-lad",
	});
	assert.equal(data.capabilities[0].purpose, "membership");
	assert.equal(data.capabilities[0].paths[0].trust.level, "verified");
});

test("reports a complete conversion path with its measured source coverage", () => {
	const response = route("GET", query, contextFor());
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "available");
	assert.deepEqual(data.paths[0].trust, {
		level: "verified",
		reasons: ["Every path step is publisher-supplied and has complete compiled coverage."],
	});
	assert.deepEqual(data.missingPrerequisites, []);
	assert.deepEqual(data.paths[0].coverage, {
		status: "complete",
		mappedSourceAreaCount: 1,
		sourceAreaCount: 1,
		share: 1,
		steps: [
			{
				crosswalkId: containmentCrosswalk.id,
				direction: "forward",
				status: "complete",
				mappedSourceAreaCount: 1,
				sourceAreaCount: 1,
				share: 1,
			},
		],
	});
});

test("reports partial coverage instead of silently treating a path as complete", () => {
	const lookup = new Map(areaLookup);
	lookup.set(
		"ward/2025-01-en-ward",
		new Map([
			...areaLookup.get("ward/2025-01-en-ward")!,
			["E05000002", { code: "E05000002", name: "Unmapped ward" }],
		]),
	);
	const response = route("GET", query, contextFor({ lookup }));
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "partial");
	assert.equal(data.paths[0].trust.level, "partial");
	assert.equal(data.paths[0].coverage.share, 0.5);
	assert.match(data.reason, /incomplete coverage/);
});

test("names a missing crosswalk artifact as a prerequisite", () => {
	const response = route("GET", query, contextFor({ crosswalks: new Map() }));
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "not-built");
	assert.equal(data.paths[0].coverage.status, "not-built");
	assert.equal(data.paths[0].trust.level, "not-built");
	assert.deepEqual(data.missingPrerequisites, [
		{
			id: "crosswalk-artifact",
			status: "not-built",
			reason: `The crosswalk artifact ${containmentCrosswalk.id} required by ${containmentCrosswalk.id}/forward/membership is not built.`,
		},
	]);
});

test("makes an undeclared purpose an explicit relationship-path prerequisite", () => {
	const response = route(
		"GET",
		query.replace("purpose=membership", "purpose=identity"),
		contextFor(),
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "unsupported");
	assert.deepEqual(data.paths, []);
	assert.deepEqual(data.missingPrerequisites, [
		{
			id: "relationship-path",
			status: "unsupported",
			reason:
				"No declared identity path is published from ward/2025-01-en-ward to localAuthority/2025-01-uk-lad.",
		},
	]);
});
