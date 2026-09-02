import { describe, expect, it } from "vitest";
import {
	buildCrossYearMappings,
	extractWardLadMappings,
} from "@/lib/data/boundaries/mappings";

const geojson = (properties: Record<string, string>) =>
	({
		type: "FeatureCollection",
		crs: { type: "name", properties: { name: "CRS84" } },
		features: [
			{
				type: "Feature",
				properties,
				geometry: {
					type: "Polygon",
					coordinates: [[[0, 0], [1, 0], [0, 1], [0, 0]]],
				},
			},
		],
	}) as any;

describe("boundary mappings", () => {
	it("extracts ward and local-authority indexes in one pass", () => {
		const mappings = extractWardLadMappings(
			geojson({ WD24CD: "W1", LAD24CD: "L1" }).features,
			["WD24CD"],
			["LAD24CD"],
		);

		expect(mappings).toEqual({
			wardToLad: { W1: "L1" },
			ladToWards: { L1: ["W1"] },
		});
	});

	it("maps same-named wards only within the same local authority", () => {
		const mappings = buildCrossYearMappings(
			{
				2023: geojson({ WD23CD: "W-old", WD23NM: "Central", LAD23CD: "L1" }),
				2024: geojson({ WD24CD: "W-new", WD24NM: " central ", LAD24CD: "L1" }),
				2025: geojson({ WD25CD: "W-other", WD25NM: "Central", LAD25CD: "L2" }),
			},
			"ward",
			[2023, 2024, 2025],
		);

		expect(mappings["W-old"]).toEqual({ 2024: "W-new" });
		expect(mappings["W-new"]).toEqual({ 2023: "W-old" });
		expect(mappings["W-other"]).toEqual({});
	});
});
