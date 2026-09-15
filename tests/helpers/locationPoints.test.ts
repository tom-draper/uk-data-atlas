import { describe, expect, it } from "vitest";
import {
	getPointsInBounds,
	getPointsInLocation,
} from "@/lib/helpers/locationPoints";

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

describe("getPointsInLocation", () => {
	const boxes: Record<string, [number, number, number, number]> = {
		"Greater Manchester": [-2.72, 53.32, -1.91, 53.68],
		"Northern Ireland": [-8.3, 53.9, -5.3, 55.4],
		Scotland: [-8.6, 54.6, 1.8, 60.9],
	};
	const lookup = {
		membersOf: (location: string) =>
			location === "Greater Manchester" ? ["E08000003"] : [],
		boundsOf: (location: string) => boxes[location],
	};

	it("places coded points by membership and uncoded points by bounding box", () => {
		const kintyre = {
			lng: -5.64,
			lat: 55.35,
			value: 1,
			areaCode: "S12000035",
		};
		const manchester = {
			lng: -2.24,
			lat: 53.48,
			value: 1,
			areaCode: "E08000003",
		};
		// Inside Greater Manchester's box but assigned to a neighbour.
		const stockport = {
			lng: -2.15,
			lat: 53.4,
			value: 1,
			areaCode: "E08000007",
		};
		const uploaded = { lng: -2.3, lat: 53.5, value: 1 };
		const points = [kintyre, manchester, stockport, uploaded];

		expect(getPointsInLocation(points, "Northern Ireland", lookup)).toEqual(
			[],
		);
		expect(getPointsInLocation(points, "Scotland", lookup)).toEqual([
			kintyre,
		]);
		expect(
			getPointsInLocation(points, "Greater Manchester", lookup),
		).toEqual([manchester, uploaded]);
		expect(getPointsInLocation(points, "United Kingdom", lookup)).toBe(
			points,
		);
	});
});
