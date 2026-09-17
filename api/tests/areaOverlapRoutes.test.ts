import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { AreaGeometryCache } from "../src/areaGeometry";
import { route as routeRequest } from "../src/routes";
import type { RouteContext } from "../src/routing";
import {
	registry,
	areaLookup,
	crosswalkLookup,
	testContext,
} from "./routeFixtures";

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
		const context = testContext({
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
		} satisfies RouteContext);
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
