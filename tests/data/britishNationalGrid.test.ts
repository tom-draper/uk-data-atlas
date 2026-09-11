import { describe, expect, it } from "vitest";
import { decodeBoundaryData } from "@/lib/data/boundaries/decode";

// PROJ's cct running EPSG:1314, OSGB36 to WGS 84 (6), as an explicit
// pipeline: inverse British National Grid, then the Helmert shift in the
// position vector convention.
const REFERENCES: Array<[[number, number], [number, number]]> = [
	[
		[651409.903, 313177.27],
		[1.71605199, 52.657978599],
	],
	[
		[325000, 673000],
		[-3.202386182, 55.944167047],
	],
	[
		[150000, 50000],
		[-5.511662554, 50.296848418],
	],
	[
		[530000, 180000],
		[-0.12835394, 51.503990828],
	],
];

describe("British National Grid reprojection", () => {
	// decode.ts follows the Ordnance Survey's own formulae and parameter
	// rounding, which agree with PROJ to a few centimetres. The tolerance is
	// there to catch a wrong sign or parameter, which costs a metre or more.
	it("matches PROJ's EPSG:1314 to within ten centimetres", () => {
		for (const [grid, [lon, lat]] of REFERENCES) {
			const { coordinates } = decodeBoundaryData({
				type: "FeatureCollection",
				crs: { type: "name", properties: { name: "EPSG:27700" } },
				features: [
					{
						type: "Feature",
						properties: {},
						geometry: { type: "Point", coordinates: grid },
					},
				],
			}).features[0]!.geometry as unknown as {
				coordinates: [number, number];
			};
			const metres = Math.hypot(
				(coordinates[0] - lon) *
					111320 *
					Math.cos((lat * Math.PI) / 180),
				(coordinates[1] - lat) * 110574,
			);
			expect(metres, `${grid}`).toBeLessThan(0.1);
		}
	});
});
