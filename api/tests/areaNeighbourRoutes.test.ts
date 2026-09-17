import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
	AreaGeometryCache,
	type GeometrySourceLookup,
} from "../src/areaGeometry";
import {
	route,
	registry,
	geographyInventory,
	areaLookup,
	crosswalkInventory,
	crosswalkLookup,
} from "./routeFixtures";

test("lists an area's neighbours with the border each shares", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(
			root,
			"data",
			"boundaries",
			"ward",
			"2025-01-en-ward",
		);
		mkdirSync(directory, { recursive: true });
		const square = (
			west: number,
			south: number,
			east: number,
			north: number,
		) => [
			[
				[west, south],
				[east, south],
				[east, north],
				[west, north],
				[west, south],
			],
		];
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { WD25CD: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: square(-1, 54, 0, 55),
						},
					},
					// Shares the whole eastern edge.
					{
						properties: { WD25CD: "E05000002" },
						geometry: {
							type: "Polygon",
							coordinates: square(0, 54, 1, 55),
						},
					},
					// Meets at the single corner (0, 55) and nowhere else.
					{
						properties: { WD25CD: "E05000003" },
						geometry: {
							type: "Polygon",
							coordinates: square(0, 55, 1, 56),
						},
					},
					// Nowhere near any of them.
					{
						properties: { WD25CD: "E05000004" },
						geometry: {
							type: "Polygon",
							coordinates: square(20, 20, 21, 21),
						},
					},
				],
			}),
		);
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025-01-en-ward",
				{
					input: "boundaries/ward/2025-01-en-ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const areaGeometryCache = new AreaGeometryCache(root, sources);
		const get = (query = "") =>
			route(
				"GET",
				`/v1/areas/ward/2025-01-en-ward/E05000001/neighbours${query}`,
				registry,
				geographyInventory,
				areaLookup,
				crosswalkInventory,
				crosswalkLookup,
				undefined,
				areaGeometryCache,
			);
		const data = (response: ReturnType<typeof get>) =>
			("data" in response.body && response.body.data) as {
				touches: string;
				border: Record<string, number>;
				neighbours: {
					code: string;
					touch: string;
					sharedBorderM: number;
					shareOfPerimeter: number;
					sharedVertices: number;
				}[];
			} & Record<string, never>;

		// By default a corner is not a neighbour.
		const edges = get();
		assert.equal(edges.status, 200);
		assert.equal(data(edges).touches, "edge");
		assert.equal(data(edges).neighbours.length, 1);
		assert.equal(data(edges).neighbours[0]!.code, "E05000002");
		assert.equal(data(edges).neighbours[0]!.touch, "edge");
		// The corner touch is still counted, so a caller can see it was left out.
		assert.equal(data(edges).border.pointOnlyTouches, 1);

		// One side of four shared, but not a quarter of the perimeter: a cell a
		// degree square is a tall rectangle on the ground, 111 km north to
		// south against 65 km east to west, so the shared meridian is nearer a
		// third of the way round.
		const share = data(edges).neighbours[0]!.shareOfPerimeter;
		assert.ok(share > 0.3 && share < 0.33, `share ${share}`);
		assert.ok(
			data(edges).border.unsharedBorderM! >
				data(edges).border.sharedBorderM! * 2,
		);

		// Asking for point touches brings the corner in, with no border length.
		const any = get("?touches=any");
		assert.equal(data(any).neighbours.length, 2);
		const corner = data(any).neighbours.find(
			(neighbour) => neighbour.code === "E05000003",
		)!;
		assert.equal(corner.touch, "point");
		assert.equal(corner.sharedBorderM, 0);
		assert.equal(corner.sharedVertices, 1);
		// Ordered by how much border each shares, so the real one leads.
		assert.equal(data(any).neighbours[0]!.code, "E05000002");

		// The distant ward is in neither answer.
		assert.equal(
			data(any).neighbours.some(
				(neighbour) => neighbour.code === "E05000004",
			),
			false,
		);

		assert.equal(get("?touches=nope").status, 400);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
