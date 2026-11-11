import { describe, expect, it } from "vitest";
import { boundsOf, centreOf } from "../../src/places/placeProfileGeometry";
import {
	readDatasetCoverage,
	readPopulations,
} from "../../src/places/placeProfileDatasets";

describe("place profile geometry", () => {
	it("calculates rounded bounds and an area-weighted centre", () => {
		const shapes = [
			[
				[
					[0, 0],
					[4, 0],
					[4, 2],
					[0, 2],
					[0, 0],
				],
			],
		];
		expect(boundsOf([shapes])).toEqual([0, 0, 4, 2]);
		expect(centreOf(shapes)).toEqual([2, 1]);
		expect(
			centreOf([
				[
					[
						[0, 0],
						[1, 1],
						[0, 0],
					],
				],
			]),
		).toBeUndefined();
	});
});

describe("place profile datasets", () => {
	it("selects the latest population and counts age totals", () => {
		const inputs: Record<string, unknown> = {
			population: {
				first: { year: 2020, data: { E00000001: { total: 10 } } },
			},
			"population-uk": {
				latest: {
					year: 2022,
					data: { E00000001: { total: { 0: 5, 1: 7 } } },
				},
			},
			"population-constituency": {},
		};
		const populations = readPopulations((name) =>
			JSON.stringify(inputs[name]),
		);
		expect(populations.get("E00000001")).toEqual({
			value: 12,
			year: 2022,
			dataset: "population-uk",
		});
	});

	it("collects and sorts dataset coverage by title and year", () => {
		const codes = Object.fromEntries(
			[1, 2, 3, 4, 5].map((n) => [`E${String(n).padStart(8, "0")}`, n]),
		);
		const inputs: Record<string, unknown> = {
			"dataset-manifest": {
				datasets: [{ output: "example", source: { name: "Example" } }],
			},
			example: {
				older: { year: 2020, data: codes },
				newer: { year: 2022, data: codes },
			},
		};
		const datasetsFor = readDatasetCoverage((name) =>
			JSON.stringify(inputs[name]),
		);
		expect(datasetsFor("E00000001")).toEqual([
			{ slug: "example", title: "Example", years: [2022, 2020] },
		]);
		expect(datasetsFor("E99999999")).toEqual([]);
	});
});
