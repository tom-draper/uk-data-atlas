import { describe, expect, it } from "vitest";
import { loadRoadSafety } from "@/lib/data/road-safety/loader";
import { Gazetteer } from "@/lib/data/gazetteer/gazetteer";
import type { GazetteerCore } from "@/lib/data/gazetteer/types";
import { getPointsInLocation } from "@/lib/helpers/locationPoints";

// Two collisions in Greater Manchester and one in London. A fourth sits on the
// Mull of Kintyre, inside Northern Ireland's bounding box but assigned to
// Argyll and Bute, and a fifth is at Heathrow, which DfT assigns to no
// authority. The last has no coordinates.
const csv = [
	"longitude,latitude,collision_severity,date,time,number_of_casualties,number_of_vehicles,speed_limit,road_type,urban_or_rural_area,local_authority_ons_district",
	"-2.24,53.48,1,2025-01-02,08:15,2,2,30,6,1,E08000003",
	"-2.30,53.50,3,2025-01-03,17:40,1,1,40,3,1,E08000003",
	"-0.12,51.50,2,2025-01-04,12:00,1,2,20,6,1,E09000033",
	"-5.64,55.35,3,2025-01-05,12:00,1,1,60,6,2,S12000035",
	"-0.45,51.47,3,2025-01-06,12:00,1,1,30,6,1,EHEATHROW",
	",,3,2025-01-07,12:00,1,1,30,6,1,E09000033",
].join("\n");

const bbox = (
	west: number,
	south: number,
	east: number,
	north: number,
): [number, number, number, number] => [west, south, east, north];

const core = {
	version: 1,
	byCode: {},
	nameIndex: {},
	namedLocations: {
		"Greater Manchester": {
			memberCodes: ["E08000003"],
			bbox: bbox(-2.72, 53.32, -1.91, 53.68),
		},
		London: {
			memberCodes: ["E09000017", "E09000033"],
			bbox: bbox(-0.51, 51.28, 0.33, 51.69),
		},
		"Northern Ireland": {
			memberCodes: [],
			bbox: bbox(-8.3, 53.9, -5.3, 55.4),
		},
		Scotland: { memberCodes: [], bbox: bbox(-8.6, 54.6, 1.8, 60.9) },
		// No bbox, so it cannot be summarised and must be left out entirely.
		Nowhere: { memberCodes: [] },
	},
} as unknown as GazetteerCore;

describe("loadRoadSafety", () => {
	const read = async () => csv;

	it("keeps the points out of the dataset the card loads", async () => {
		const { datasets, points } = await loadRoadSafety(
			read,
			new Gazetteer(core),
		);

		const dataset = datasets.roadSafety2025;
		expect(dataset.points).toBeUndefined();
		// Rows without coordinates are dropped, as before.
		expect(points.roadSafety2025).toHaveLength(5);
		expect(dataset).toMatchObject({
			id: "roadSafety2025",
			type: "custom",
			kind: "points",
			valueMin: 1,
			valueMax: 3,
		});
	});

	it("summarises each named location exactly as the card would count it", async () => {
		const { datasets, points } = await loadRoadSafety(
			read,
			new Gazetteer(core),
		);
		const summaries = datasets.roadSafety2025.pointSummaries!;

		for (const [name, location] of Object.entries(core.namedLocations)) {
			const bounds = location.bbox;
			if (!bounds) {
				expect(summaries[name]).toBeUndefined();
				continue;
			}
			const located = getPointsInLocation(
				points.roadSafety2025,
				name,
				new Gazetteer(core),
			);
			const total = located.reduce((sum, p) => sum + p.value, 0);
			expect(summaries[name].count).toBe(located.length);
			expect(summaries[name].averageValue).toBeCloseTo(
				located.length > 0 ? total / located.length : 0,
				3,
			);
		}

		// Fatal weights 3 and Slight weights 1, so their mean is 2.
		expect(summaries["Greater Manchester"]).toEqual({
			count: 2,
			averageValue: 2,
		});
		// Heathrow's collision is placed in Hillingdon, so London counts it.
		expect(summaries.London).toEqual({ count: 2, averageValue: 1.5 });
		// Kintyre is inside Northern Ireland's box but belongs to Scotland.
		expect(summaries["Northern Ireland"]).toEqual({
			count: 0,
			averageValue: 0,
		});
		expect(summaries.Scotland).toEqual({ count: 1, averageValue: 1 });
	});
});
