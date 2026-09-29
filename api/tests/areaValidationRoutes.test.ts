import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { route as routeRequest } from "../src/routes";
import {
	containmentCrosswalk,
	registry,
	areaLookup,
	testContext,
} from "./routeFixtures";

test("validates a batch of codes and names against one release", () => {
	const context = testContext({
		boundaryRegistry: registry,
		areaLookup,
	});
	const validate = (query: string) =>
		routeRequest("GET", `/v1/areas:validate?${query}`, context);

	const response = validate(
		"geography=ward&release=2025-01-en-ward&value=E05000001&value=enghraifft%20ward&value=E05999999",
	);
	assert.equal(response.status, 200);
	const data = (
		response.body as {
			data: {
				summary: {
					byStatus: Record<string, number>;
					joinable: boolean;
				};
				values: Array<{ status: string; match?: string }>;
			};
		}
	).data;
	assert.deepEqual(
		data.values.map((value) => value.status),
		["valid", "matched", "unknown"],
	);
	assert.equal(data.values[1]?.match, "alias");
	assert.equal(data.summary.joinable, false);

	assert.equal(validate("geography=ward&value=E05000001").status, 400);
	assert.equal(
		validate("geography=ward&release=2025-01-en-ward").status,
		400,
	);
	assert.equal(
		validate(
			`geography=ward&release=2025-01-en-ward&${Array.from({ length: 501 }, () => "value=x").join("&")}`,
		).status,
		400,
	);
	const unknownRelease = validate(
		"geography=ward&release=2019-12-en-ward&value=E05000001",
	);
	assert.equal(unknownRelease.status, 404);
	assert.equal(
		"code" in unknownRelease.body && unknownRelease.body.code,
		"unsupported_geography",
	);
});

test("infers a likely release, reports a mixed code column, and recommends only its published path", () => {
	const matchingAreas = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:ward-2024",
			geography: "ward",
			boundaryRelease: "2024-01-en-ward",
			codeProperty: "WD24CD",
			nameProperty: "WD24NM",
			areas: [{ code: "E05000001", name: "Old ward" }],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:ward-2025",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [{ code: "E05000002", name: "New ward" }],
		},
	]);
	const succession = {
		...containmentCrosswalk,
		id: "ward-2024-to-2025",
		method: "official-lookup" as const,
		weighting: { status: "not-provided" as const },
		from: { geography: "ward", boundaryRelease: "2024-01-en-ward" },
		to: { geography: "ward", boundaryRelease: "2025-01-en-ward" },
		records: [
			{
				source: { code: "E05000001", labels: ["Old ward"] },
				targets: [{ code: "E05000002", labels: ["New ward"] }],
			},
		],
	};
	const response = routeRequest(
		"GET",
		"/v1/areas:validate?value=E05000001&value=E05000002",
		testContext({
			areaLookup: matchingAreas,
			crosswalkLookup: new Map([[succession.id, succession]]),
		}),
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: Record<string, any> }).data;
	assert.deepEqual(data.likely, {
		geography: "ward",
		boundaryRelease: "2025-01-en-ward",
		resolved: 1,
		summary: {
			valueCount: 2,
			byStatus: { superseded: 1, valid: 1 },
			duplicateCount: 0,
			normalisedCount: 0,
			joinable: false,
		},
	});
	assert.equal(data.verdict, "mixed-code-systems");
	assert.deepEqual(
		data.recommendations.map((path: { id: string }) => path.id),
		["ward-2024-to-2025/forward/identity"],
	);
});

test("uses a published parent relationship to settle a shared name", () => {
	const matchingAreas = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:shared-wards",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [
				{ code: "E05000001", name: "Shared ward" },
				{ code: "E05000002", name: "Shared ward" },
			],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:authorities",
			geography: "localAuthority",
			boundaryRelease: "2025-01-uk-lad",
			codeProperty: "LAD25CD",
			nameProperty: "LAD25NM",
			areas: [
				{ code: "E08000001", name: "North council" },
				{ code: "E08000002", name: "South council" },
			],
		},
	]);
	const parents = {
		...containmentCrosswalk,
		records: [
			{
				source: { code: "E05000001", labels: ["Shared ward"] },
				targets: [{ code: "E08000001", labels: ["North council"] }],
			},
			{
				source: { code: "E05000002", labels: ["Shared ward"] },
				targets: [{ code: "E08000002", labels: ["South council"] }],
			},
		],
	};
	const response = routeRequest(
		"GET",
		"/v1/areas:validate?geography=ward&release=2025-01-en-ward&value=Shared%20ward&parent=North%20council",
		testContext({
			areaLookup: matchingAreas,
			crosswalkLookup: new Map([[parents.id, parents]]),
		}),
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: Record<string, any> }).data;
	assert.deepEqual(data.values[0], {
		index: 0,
		value: "Shared ward",
		kind: "name",
		status: "matched",
		match: "exact",
		area: {
			id: "ward/2025-01-en-ward/E05000001",
			code: "E05000001",
			name: "Shared ward",
		},
		parent: {
			value: "North council",
			match: "name",
			area: {
				id: "localAuthority/2025-01-uk-lad/E08000001",
				code: "E08000001",
				name: "North council",
			},
			crosswalk: "ward-to-local-authority-2025",
		},
	});
});

test("recommends a published relationship for a code held by another geography", () => {
	const matchingAreas = createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:wards",
			geography: "ward",
			boundaryRelease: "2025-01-en-ward",
			codeProperty: "WD25CD",
			nameProperty: "WD25NM",
			areas: [{ code: "E05000001", name: "Example ward" }],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:authorities",
			geography: "localAuthority",
			boundaryRelease: "2024-01-uk-lad",
			codeProperty: "LAD24CD",
			nameProperty: "LAD24NM",
			areas: [{ code: "E08000001", name: "Example council" }],
		},
	]);
	const membership = {
		...containmentCrosswalk,
		id: "ward-to-authority",
		from: { geography: "ward", boundaryRelease: "2025-01-en-ward" },
		to: {
			geography: "localAuthority",
			boundaryRelease: "2024-01-uk-lad",
		},
		records: [
			{
				source: { code: "E05000001", labels: ["Example ward"] },
				targets: [{ code: "E08000001", labels: ["Example council"] }],
			},
		],
	};
	const response = routeRequest(
		"GET",
		"/v1/areas:validate?value=E05000001&value=E08000001",
		testContext({
			areaLookup: matchingAreas,
			crosswalkLookup: new Map([[membership.id, membership]]),
		}),
	);
	const data = (response.body as { data: Record<string, any> }).data;
	assert.equal(data.verdict, "mixed-code-systems");
	assert.deepEqual(
		data.recommendations.map((path: { id: string }) => path.id),
		["ward-to-authority/reverse/membership"],
	);
});
