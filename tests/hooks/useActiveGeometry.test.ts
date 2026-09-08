import { describe, expect, it } from "vitest";
import {
	geometryForRequest,
	geometryRequestKey,
} from "@/lib/hooks/useActiveGeometry";

const geometry = {
	type: "FeatureCollection",
	features: [],
} as any;

describe("active geometry requests", () => {
	it("withholds a previous vintage while a new one is loading", () => {
		const ward2024 = geometryRequestKey(
			"/data/boundaries/ward/2024.topojson",
			"ward",
			"Greater Manchester",
		);
		const ward2021 = geometryRequestKey(
			"/data/boundaries/ward/2021.topojson",
			"ward",
			"Greater Manchester",
		);

		expect(geometryForRequest(geometry, ward2024, ward2021)).toBeNull();
		expect(geometryForRequest(geometry, ward2021, ward2021)).toBe(geometry);
	});

	it("treats a location-filter change as a new geometry request", () => {
		const greaterManchester = geometryRequestKey(
			"/data/boundaries/ward/2024.topojson",
			"ward",
			"Greater Manchester",
		);
		const westMidlands = geometryRequestKey(
			"/data/boundaries/ward/2024.topojson",
			"ward",
			"West Midlands",
		);

		expect(
			geometryForRequest(geometry, greaterManchester, westMidlands),
		).toBeNull();
	});
});
