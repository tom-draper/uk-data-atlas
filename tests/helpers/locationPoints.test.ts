import { describe, expect, it } from "vitest";
import { getPointsInBounds } from "@/lib/helpers/locationPoints";

describe("getPointsInBounds", () => {
	it("reuses a location subset without crossing datasets", () => {
		const points = [
			{ lng: -1, lat: 51, value: 1 },
			{ lng: 1, lat: 53, value: 2 },
		];
		const bounds: [number, number, number, number] = [-2, 50, 0, 52];

		const firstVisit = getPointsInBounds(points, bounds);
		const secondVisit = getPointsInBounds(points, bounds);

		expect(secondVisit).toBe(firstVisit);
		expect(firstVisit).toEqual([points[0]]);

		const replacementDataset = [{ lng: 1, lat: 53, value: 1 }];
		expect(getPointsInBounds(replacementDataset, bounds)).toEqual([]);
	});
});
