import assert from "node:assert/strict";
import test from "node:test";
import type {
	CrosswalkArtifact,
	PropertyCrosswalkArtifact,
} from "../src/crosswalkInventory";
import { route as routeRequest } from "../src/routes";
import {
	areaLookup,
	crosswalkArtifact,
	containmentCrosswalk,
	dataCatalog,
	geographyInventory,
	populationObservations,
	routeWithData,
	testContext,
} from "./routeFixtures";

test("converts a measure only through a crosswalk the caller names", () => {
	const base =
		"/v1/data/population-estimate/convert?period=2022&geography=ward&boundaryYear=2023";

	// The route never picks a conversion path on the caller's behalf.
	assert.equal(routeWithData(base).status, 400);
	assert.equal(routeWithData(`${base}&crosswalk=not-published`).status, 404);

	// A crosswalk that starts somewhere else cannot convert this partition.
	const wrongStart = routeWithData(
		`${base}&crosswalk=${crosswalkArtifact.id}`,
	);
	assert.equal(wrongStart.status, 422);
	assert.match(
		"detail" in wrongStart.body ? wrongStart.body.detail : "",
		/starts at constituency/,
	);
	assert.equal(
		"code" in wrongStart.body && wrongStart.body.code,
		"conversion_not_available",
	);
	assert.equal(
		"absence" in wrongStart.body && wrongStart.body.absence,
		"crosswalk-geography-mismatch",
	);

	// A source area the crosswalk does not map would drop out of the total.
	const unmapped = routeWithData(
		`${base}&crosswalk=${containmentCrosswalk.id}`,
	);
	assert.equal(unmapped.status, 422);
	assert.deepEqual(
		"code" in unmapped.body && {
			code: unmapped.body.code,
			absence: unmapped.body.absence,
			areaCount: unmapped.body.areaCount,
			areaSample: unmapped.body.areaSample,
		},
		{
			code: "conversion_not_available",
			absence: "source-areas-not-mapped",
			areaCount: 1,
			areaSample: ["W05000001"],
		},
	);

	// A share cannot be regrouped by adding it up.
	const intensive = routeWithData(
		`/v1/data/mobile-5g-coverage/convert?period=2025&geography=localAuthority&boundaryYear=2024&crosswalk=${crosswalkArtifact.id}`,
	);
	assert.equal(intensive.status, 422);
	assert.match(
		"detail" in intensive.body ? intensive.body.detail : "",
		/Only an extensive measure can be converted/,
	);
	assert.equal(
		"code" in intensive.body && intensive.body.code,
		"aggregation_not_supported",
	);
});

const wardToAuthority: PropertyCrosswalkArtifact = {
	...containmentCrosswalk,
	id: "ward-to-authority",
	records: [
		{
			source: { code: "E05000001", labels: [] },
			targets: [{ code: "E08000001", labels: [] }],
		},
		{
			source: { code: "W05000001", labels: [] },
			targets: [{ code: "W06000001", labels: [] }],
		},
	],
};

const authorityToArea = (
	records: Array<[string, Array<[string, number]>]>,
): CrosswalkArtifact =>
	({
		...containmentCrosswalk,
		id: "authority-to-area",
		method: "area-overlap",
		quality: "derived",
		weighting: { status: "published", basis: "area" },
		from: containmentCrosswalk.to,
		to: { geography: "healthArea", boundaryRelease: "2025" },
		records: records.map(([source, targets]) => ({
			source: { code: source, labels: [], areaM2: 1, coverage: 1 },
			targets: targets.map(([code, weight]) => ({
				code,
				labels: [],
				weight,
				overlapAreaM2: weight,
				sourceShare: weight,
				targetShare: 1,
			})),
		})),
	}) as unknown as CrosswalkArtifact;

const pathContext = (second: CrosswalkArtifact) =>
	testContext({
		geographyInventory,
		areaLookup,
		dataCatalog,
		populationObservations,
		crosswalkLookup: new Map<string, CrosswalkArtifact>([
			[wardToAuthority.id, wardToAuthority],
			[second.id, second],
		]),
		relationshipPathInventory: {
			schemaVersion: 1,
			contentHash: "sha256:paths",
			crosswalkInventoryHash: "sha256:crosswalks",
			paths: [
				{
					id: "ward-to-health-area",
					purpose: "apportion",
					from: wardToAuthority.from,
					to: second.to,
					quality: "derived",
					origin: "declared",
					steps: [
						{
							crosswalkId: wardToAuthority.id,
							direction: "forward",
							method: wardToAuthority.method,
							purpose: "membership",
						},
						{
							crosswalkId: second.id,
							direction: "forward",
							method: second.method,
							purpose: "apportion",
						},
					],
				},
			],
		},
	});

test("converts a measure through every step of a published path the caller names", () => {
	const base =
		"/v1/data/population-estimate/convert?period=2022&geography=ward&boundaryYear=2023";
	const context = pathContext(
		authorityToArea([
			["E08000001", [["H1", 0.25], ["H2", 0.75]]],
			["W06000001", [["H3", 1]]],
		]),
	);

	assert.equal(
		routeRequest("GET", `${base}&path=ward-to-health-area&crosswalk=${wardToAuthority.id}`, context).status,
		400,
	);
	assert.equal(routeRequest("GET", `${base}&path=not-published`, context).status, 404);

	const converted = routeRequest("GET", `${base}&path=ward-to-health-area`, context);
	assert.equal(converted.status, 200);
	const data = (converted.body as { data: Record<string, any> }).data;
	assert.deepEqual(data.targetGeography, { type: "healthArea", boundaryRelease: "2025" });
	assert.equal(data.conversion.method, "area-weighted");
	assert.equal(data.conversion.crosswalk, undefined);
	assert.deepEqual(
		data.conversion.path.steps.map(
			(step: { direction: string; crosswalk: { id: string } }) => [step.crosswalk.id, step.direction],
		),
		[
			["ward-to-authority", "forward"],
			["authority-to-area", "forward"],
		],
	);
	assert.deepEqual(
		data.records.map((record: { areaCode: string; value: number }) => [record.areaCode, record.value]),
		[
			["H1", 25],
			["H2", 75],
			["H3", 200],
		],
	);
});

test("refuses a path whose later step would drop a value", () => {
	const refused = routeRequest(
		"GET",
		"/v1/data/population-estimate/convert?period=2022&geography=ward&boundaryYear=2023&path=ward-to-health-area",
		pathContext(authorityToArea([["E08000001", [["H1", 1]]]])),
	);

	assert.equal(refused.status, 422);
	const body = refused.body as { absence: string; areaSample: string[]; detail: string };
	assert.equal(body.absence, "source-areas-not-mapped");
	assert.deepEqual(body.areaSample, ["W05000001"]);
	assert.match(body.detail, /Step 2 of the path, crosswalk authority-to-area/);
});
