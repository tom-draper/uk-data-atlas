import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { AreaGeometryCache } from "../src/areaGeometry";
import { route as routeRequest } from "../src/routes";
import type { RouteContext } from "../src/routing";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
	atlasRelease,
} from "./routeFixtures";

test("uses the immutable release id in every successful envelope", () => {
	const response = route(
		"GET",
		"/v1/geographies",
		registry,
		geographyInventory,
		areaLookup,
		crosswalkInventory,
		crosswalkLookup,
		atlasRelease,
	);
	assert.equal(response.status, 200);
	assert.equal(
		"atlasRelease" in response.body && response.body.atlasRelease,
		atlasRelease.releaseId,
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
	// An unknown release lists the releases the geography does have.
	assert.deepEqual(
		"code" in missing.body && [
			missing.body.code,
			missing.body.absence,
			missing.body.availableReleases,
		],
		[
			"unsupported_geography",
			"unknown-release",
			[
				{
					id: "2025-01-en-ward",
					href: "/v1/boundary-releases/ward/2025-01-en-ward",
				},
			],
		],
	);

	const write = route("POST", "/v1/geographies", registry);
	assert.equal(write.status, 405);
	assert.equal(
		"title" in write.body && write.body.title,
		"Method Not Allowed",
	);
});

test("explains why an area identity resolves to nothing", () => {
	const unknownCode = route(
		"GET",
		"/v1/areas/ward/2025-01-en-ward/E05999999/relationships",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(unknownCode.status, 404);
	assert.deepEqual(unknownCode.body, {
		type: "https://api.ukdataatlas.com/problems/not-found",
		title: "Not Found",
		status: 404,
		detail: "E05999999 is held by no compiled release of this geography.",
		code: "area_not_in_release",
		absence: "unknown",
		presentIn: [],
	});
	const unknownRelease = route(
		"GET",
		"/v1/areas/ward/2019-12-en-ward/E05000001",
		registry,
		geographyInventory,
		areaLookup,
	);
	assert.equal(unknownRelease.status, 404);
	assert.deepEqual(unknownRelease.body, {
		type: "https://api.ukdataatlas.com/problems/not-found",
		title: "Not Found",
		status: 404,
		detail: "No ward boundary release is published as 2019-12-en-ward.",
		code: "unsupported_geography",
		absence: "unknown-release",
		availableReleases: [
			{
				id: "2025-01-en-ward",
				href: "/v1/boundary-releases/ward/2025-01-en-ward",
			},
		],
	});
});

test("measures how two areas overlap beside any published relationship", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const square = (
			west: number,
			south: number,
			east: number,
			north: number,
		) => ({
			type: "Polygon",
			coordinates: [
				[
					[west, south],
					[east, south],
					[east, north],
					[west, north],
					[west, south],
				],
			],
		});
		const write = (
			path: string,
			codeProperty: string,
			features: Array<[string, unknown]>,
		) => {
			mkdirSync(join(root, "data", path, ".."), { recursive: true });
			writeFileSync(
				join(root, "data", path),
				JSON.stringify({
					type: "FeatureCollection",
					features: features.map(([code, geometry]) => ({
						properties: { [codeProperty]: code },
						geometry,
					})),
				}),
			);
		};
		write("boundaries/ward/2025-01-en-ward/wards.geojson", "WD25CD", [
			["E05000001", square(-1, 54, -0.5, 54.5)],
		]);
		write(
			"boundaries/local-authority/2025-01-uk-lad/lad.geojson",
			"LAD25CD",
			[["E08000001", square(-1, 54, 0, 55)]],
		);
		const context = {
			boundaryRegistry: registry,
			areaLookup,
			crosswalkLookup,
			areaGeometryCache: new AreaGeometryCache(
				root,
				new Map([
					[
						"ward/2025-01-en-ward",
						{
							input: "boundaries/ward/2025-01-en-ward/wards.geojson",
							crs: "EPSG:4326",
							codeProperty: "WD25CD",
						},
					],
					[
						"localAuthority/2025-01-uk-lad",
						{
							input: "boundaries/local-authority/2025-01-uk-lad/lad.geojson",
							crs: "EPSG:4326",
							codeProperty: "LAD25CD",
						},
					],
				]),
			),
		} satisfies RouteContext;
		const url = "/v1/areas/ward/2025-01-en-ward/E05000001/overlap";

		const response = routeRequest(
			"GET",
			`${url}?with=localAuthority/2025-01-uk-lad/E08000001`,
			context,
		);
		assert.equal(response.status, 200);
		const data = (response.body as { data: Record<string, unknown> }).data;
		assert.equal(data.relation, "within");
		const overlap = data.overlap as {
			shareOfFirst: number;
			shareOfSecond: number;
			pieceCount: number;
		};
		assert.equal(overlap.shareOfFirst, 1);
		assert.ok(overlap.shareOfSecond > 0.24 && overlap.shareOfSecond < 0.26);
		assert.equal(overlap.pieceCount, 1);
		assert.deepEqual(
			(
				data.publishedRelationships as Array<{
					relation: string;
					crosswalk: { id: string };
				}>
			).map((relationship) => [
				relationship.relation,
				relationship.crosswalk.id,
			]),
			[["within", "ward-to-local-authority-2025"]],
		);
		assert.equal(
			(data.method as { sliverWidthM: number }).sliverWidthM,
			100,
		);

		assert.equal(routeRequest("GET", url, context).status, 400);
		const missingOther = routeRequest(
			"GET",
			`${url}?with=ward/2025-01-en-ward/E05999999`,
			context,
		);
		assert.equal(missingOther.status, 404);
		assert.equal(
			"code" in missingOther.body && missingOther.body.code,
			"area_not_in_release",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("validates a batch of codes and names against one release", () => {
	const context = {
		boundaryRegistry: registry,
		areaLookup,
	} satisfies RouteContext;
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
