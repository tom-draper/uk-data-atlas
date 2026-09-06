import { describe, expect, it } from "vitest";
import { getCachedFilteredBoundaryData } from "@/lib/hooks/useBoundaryData";
import type { BoundaryData } from "@/lib/types";

const feature = (code: string) => ({
	type: "Feature" as const,
	id: 1,
	properties: { WD24CD: code },
	geometry: {
		type: "Polygon" as const,
		coordinates: [
			[
				[0, 0],
				[1, 0],
				[1, 1],
				[0, 0],
			],
		],
	},
});

const boundaryData = (code: string): BoundaryData => {
	const geojson = {
		type: "FeatureCollection" as const,
		crs: {
			type: "name" as const,
			properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
		},
		features: [feature(code)],
	} as any;

	return {
		ward: { 2024: geojson },
		constituency: { 2024: geojson },
		localAuthority: { 2024: geojson },
		lsoa: { 2011: geojson },
		dataZone: { 2011: geojson },
		superOutputArea: { 2011: geojson },
		country: { 2025: geojson },
		localPlanningAuthority: { 2019: geojson },
		region: { 2025: geojson },
		countyAndUnitaryAuthority: { 2025: geojson },
		integratedCareBoard: { 2026: geojson },
		msoa: { 2021: geojson },
		communitySafetyPartnership: { 2023: geojson },
		policeForceArea: { 2023: geojson },
		combinedAuthority: { 2025: geojson },
		itl1: { 2021: geojson },
		itl2: { 2021: geojson },
		itl3: { 2021: geojson },
		majorTownAndCity: { 2015: geojson },
		scottishParliamentaryConstituency: { 2021: geojson },
		scottishParliamentaryRegion: { 2022: geojson },
		seneddConstituency: { 2022: geojson },
		seneddElectoralRegion: { 2022: geojson },
		localHealthBoard: { 2023: geojson },
		nhsEnglandRegion: { 2022: geojson },
		subIntegratedCareBoardLocation: { 2026: geojson },
		fireAndRescueAuthority: { 2021: geojson },
		nationalPark: { 2020: geojson },
		countyElectoralDivision: { 2023: geojson },
		travelToWorkArea: { 2011: geojson },
	};
};

describe("getCachedFilteredBoundaryData", () => {
	it("reuses results for a visited location without crossing raw payloads", () => {
		const firstPayload = boundaryData("E0001");
		const firstVisit = getCachedFilteredBoundaryData(
			firstPayload,
			"England",
		);
		const secondVisit = getCachedFilteredBoundaryData(
			firstPayload,
			"England",
		);

		expect(secondVisit).toBe(firstVisit);
		expect(firstVisit.ward[2024]?.features).toHaveLength(1);

		const replacementPayload = boundaryData("S0001");
		const replacementVisit = getCachedFilteredBoundaryData(
			replacementPayload,
			"England",
		);

		expect(replacementVisit).not.toBe(firstVisit);
		expect(replacementVisit.ward[2024]?.features).toHaveLength(0);
	});
});
