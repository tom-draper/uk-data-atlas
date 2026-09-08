import { describe, expect, it } from "vitest";
import { loadRoadSafety } from "@/lib/data/road-safety/loader";
import { Gazetteer } from "@/lib/data/gazetteer/gazetteer";
import type { GazetteerCore } from "@/lib/data/gazetteer/types";
import { getPointsInBounds } from "@/lib/helpers/locationPoints";

// Two collisions in Greater Manchester and one well outside it, so a summary
// that ignored the bounding box would be visibly wrong.
const csv = [
	"longitude,latitude,collision_severity,date,time,number_of_casualties,number_of_vehicles,speed_limit,road_type,urban_or_rural_area",
	"-2.24,53.48,1,2025-01-02,08:15,2,2,30,6,1",
	"-2.30,53.50,3,2025-01-03,17:40,1,1,40,3,1",
	"-0.12,51.50,2,2025-01-04,12:00,1,2,20,6,1",
	",,3,2025-01-05,12:00,1,1,30,6,1",
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
			memberCodes: [],
			bbox: bbox(-2.72, 53.32, -1.91, 53.68),
		},
		London: { memberCodes: [], bbox: bbox(-0.51, 51.28, 0.33, 51.69) },
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
		expect(points.roadSafety2025).toHaveLength(3);
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
			const inBounds = getPointsInBounds(points.roadSafety2025, bounds);
			const total = inBounds.reduce((sum, p) => sum + p.value, 0);
			expect(summaries[name].count).toBe(inBounds.length);
			expect(summaries[name].averageValue).toBeCloseTo(
				inBounds.length > 0 ? total / inBounds.length : 0,
				3,
			);
		}

		// Fatal weights 3 and Slight weights 1, so their mean is 2.
		expect(summaries["Greater Manchester"]).toEqual({
			count: 2,
			averageValue: 2,
		});
		expect(summaries.London).toEqual({ count: 1, averageValue: 2 });
	});
});
