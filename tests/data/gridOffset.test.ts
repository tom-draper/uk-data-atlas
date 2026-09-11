import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeBoundaryData } from "@/lib/data/boundaries/decode";
import {
	applyGridOffset,
	offsetPosition,
	parseGridOffset,
} from "@/lib/data/boundaries/gridOffset";

const OFFSET = parseGridOffset(
	JSON.parse(
		readFileSync(
			join(
				process.cwd(),
				"data",
				"boundaries",
				"northern-ireland-offset.json",
			),
			"utf8",
		),
	),
	"northern-ireland-offset.json",
);

// Vertices of Belfast (N09000003) as published in the December 2022 British
// National Grid release, beside the same vertices in the May 2023 WGS84
// release, which lies within a metre of NISRA's native boundaries.
const BELFAST: Array<[[number, number], [number, number]]> = [
	[
		[146735.3716, 535611.068399999],
		[-5.92667629418007, 54.6517365953071],
	],
	[
		[147699.0151, 525635.4956],
		[-5.90319402705722, 54.5627695486463],
	],
	[
		[138415.8174, 524653.8094],
		[-6.04554590138859, 54.5492561938657],
	],
];

const collection = (code: string, position: [number, number]) => ({
	type: "FeatureCollection" as const,
	crs: { type: "name", properties: { name: "EPSG:27700" } },
	features: [
		{
			type: "Feature" as const,
			properties: { LAD22CD: code },
			geometry: { type: "Point" as const, coordinates: position },
		},
	],
});

const reprojected = (input: ReturnType<typeof collection>) =>
	decodeBoundaryData(input).features[0]!.geometry as unknown as {
		coordinates: [number, number];
	};

/** Metres between two nearby WGS84 positions. */
const metres = ([lon1, lat1]: number[], [lon2, lat2]: number[]) =>
	Math.hypot(
		(lon1! - lon2!) * 111320 * Math.cos((lat1! * Math.PI) / 180),
		(lat1! - lat2!) * 110574,
	);

describe("Northern Ireland grid offset", () => {
	it("moves Belfast onto the ONS's WGS84 release", () => {
		for (const [grid, wgs84] of BELFAST) {
			const before = reprojected(collection("N09000003", grid));
			const after = reprojected(
				applyGridOffset(
					collection("N09000003", grid),
					OFFSET,
					"LAD22CD",
					"test",
				),
			);
			expect(metres(before.coordinates, wgs84)).toBeGreaterThan(50);
			expect(metres(after.coordinates, wgs84)).toBeLessThan(0.1);
		}
	});

	it("leaves Great Britain alone", () => {
		const isleOfWight: [number, number] = [463996.4988, 93783.6040000003];
		expect(() =>
			applyGridOffset(
				collection("E06000046", isleOfWight),
				OFFSET,
				"LAD22CD",
				"test",
			),
		).toThrow(/no LAD22CD starts with N/);
		const mixed = {
			...collection("E06000046", isleOfWight),
			features: [
				...collection("E06000046", isleOfWight).features,
				...collection("N09000003", BELFAST[0]![0]).features,
			],
		};
		const moved = applyGridOffset(mixed, OFFSET, "LAD22CD", "test");
		expect(moved.features[0]!.geometry).toEqual(
			mixed.features[0]!.geometry,
		);
		expect(moved.features[1]!.geometry).not.toEqual(
			mixed.features[1]!.geometry,
		);
	});

	it("refuses a source outside the offset's grid", () => {
		const wgs84 = {
			...collection("N09000003", BELFAST[0]![1]),
			crs: { type: "name", properties: { name: "EPSG:4326" } },
		};
		expect(() => applyGridOffset(wgs84, OFFSET, "LAD22CD", "test")).toThrow(
			/corrects EPSG:27700 coordinates, but the source is EPSG:4326/,
		);
	});

	it("keeps any coordinate beyond easting and northing", () => {
		expect(offsetPosition(OFFSET, [146735, 535611, 12])[2]).toBe(12);
	});
});
