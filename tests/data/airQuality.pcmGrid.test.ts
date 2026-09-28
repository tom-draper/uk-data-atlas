import { describe, expect, it } from "vitest";
import {
	assignCellsToAreas,
	parsePcmGrid,
	pointInGeometry,
	type AreaGeometry,
} from "@/lib/data/air-quality/pcmGrid";

const map = `no2,,,
2024,,,
annual mean,,,
ug m-3,,,
,,,
gridcode,x,y,no22024
55671,460500,1219500,0.6950168
56360,459500,1218500,MISSING
56361,460500,1218500,12.5
`;

const square = (west: number, south: number, size: number): AreaGeometry => ({
	type: "Polygon",
	coordinates: [
		[
			[west, south],
			[west + size, south],
			[west + size, south + size],
			[west, south + size],
			[west, south],
		],
	],
});

describe("PCM background maps", () => {
	it("reads the header and every modelled cell, skipping missing ones", () => {
		const grid = parsePcmGrid(map);

		expect(grid).toMatchObject({
			pollutant: "no2",
			year: 2024,
			metric: "annual mean",
			units: "ug m-3",
		});
		expect(grid.cells).toEqual([
			{ gridcode: "55671", x: 460500, y: 1219500, value: 0.6950168 },
			{ gridcode: "56361", x: 460500, y: 1218500, value: 12.5 },
		]);
	});

	it("refuses a map that is not an annual mean", () => {
		expect(() =>
			parsePcmGrid(map.replace("annual mean", "days above 50")),
		).toThrow(/annual mean/);
	});

	it("excludes a point inside a hole", () => {
		const withHole: AreaGeometry = {
			type: "Polygon",
			coordinates: [
				square(0, 0, 10).coordinates[0] as number[][],
				square(4, 4, 2).coordinates[0] as number[][],
			],
		};
		expect(pointInGeometry(1, 1, withHole)).toBe(true);
		expect(pointInGeometry(5, 5, withHole)).toBe(false);
	});

	it("gives each cell centre to the area containing it, or to none", () => {
		const areas = [
			{ code: "A", geometry: square(0, 0, 1) },
			{
				code: "B",
				geometry: {
					type: "MultiPolygon",
					coordinates: [
						square(1, 0, 1).coordinates,
						square(5, 5, 1).coordinates,
					],
				} as AreaGeometry,
			},
		];
		expect(
			assignCellsToAreas(
				[
					[0.5, 0.5],
					[1.5, 0.5],
					[5.5, 5.5],
					[3, 3],
				],
				areas,
			),
		).toEqual(["A", "B", "B", undefined]);
	});
});
