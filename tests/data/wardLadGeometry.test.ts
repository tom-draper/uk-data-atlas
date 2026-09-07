import { describe, expect, it } from "vitest";
import { wardLadFromGeometry } from "@/lib/data/boundaries/wardLadGeometry";
import type { BoundaryGeojson } from "@/lib/types";

type Features = BoundaryGeojson["features"];

const polygon = (
	code: string,
	key: string,
	ring: number[][],
	holes: number[][][] = [],
) =>
	({
		type: "Feature",
		properties: { [key]: code },
		geometry: { type: "Polygon", coordinates: [ring, ...holes] },
	}) as unknown as Features[0];

const box = (west: number, south: number, east: number, north: number) => [
	[west, south],
	[east, south],
	[east, north],
	[west, north],
	[west, south],
];

const resolve = (wards: Features, lads: Features) =>
	wardLadFromGeometry(wards, ["WDCD"], lads, ["LADCD"], () => true);

describe("wardLadFromGeometry", () => {
	const lads = [
		polygon("LAD_WEST", "LADCD", box(0, 0, 10, 10)),
		polygon("LAD_EAST", "LADCD", box(10, 0, 20, 10)),
	] as Features;

	it("places a ward in the authority that contains it", () => {
		const wards = [
			polygon("W1", "WDCD", box(1, 1, 4, 4)),
			polygon("W2", "WDCD", box(12, 2, 18, 8)),
		] as Features;

		expect(resolve(wards, lads)).toEqual({
			W1: "LAD_WEST",
			W2: "LAD_EAST",
		});
	});

	it("does not hand a ward to the neighbour it merely touches", () => {
		// Flush against the shared border, so its eastern vertices sit exactly
		// on LAD_EAST. The authority holding the bulk of it has to win.
		const wards = [polygon("W3", "WDCD", box(6, 1, 10, 9))] as Features;

		expect(resolve(wards, lads)).toEqual({ W3: "LAD_WEST" });
	});

	it("keeps a ward out of a hole in an authority", () => {
		const holed = [
			polygon("LAD_RING", "LADCD", box(0, 0, 10, 10), [box(4, 4, 6, 6)]),
		] as Features;
		const wards = [
			polygon("W4", "WDCD", box(4.4, 4.4, 5.6, 5.6)),
		] as Features;

		expect(resolve(wards, holed)).toEqual({});
	});

	it("skips wards the caller has already accounted for", () => {
		const wards = [polygon("W5", "WDCD", box(1, 1, 4, 4))] as Features;

		expect(
			wardLadFromGeometry(
				wards,
				["WDCD"],
				lads,
				["LADCD"],
				(code) => code !== "W5",
			),
		).toEqual({});
	});

	it("resolves a multipolygon ward from its largest part", () => {
		const islands = [
			{
				type: "Feature",
				properties: { WDCD: "W6" },
				geometry: {
					type: "MultiPolygon",
					coordinates: [
						[box(19.9, 9.9, 19.95, 9.95)],
						[box(11, 1, 19, 9)],
					],
				},
			} as unknown as Features[0],
		] as Features;

		expect(resolve(islands, lads)).toEqual({ W6: "LAD_EAST" });
	});
});
