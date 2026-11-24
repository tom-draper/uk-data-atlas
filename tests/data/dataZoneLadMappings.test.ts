import { describe, expect, it } from "vitest";
import {
	councilDataZones,
	parseDataZoneLadMappings,
} from "@/lib/data/boundaries/dataZoneLadMappings";

const lookup = {
	version: 1,
	targetLocalAuthorityRelease: "2025-05-uk-bfc",
	releases: [
		{
			boundaryYear: 2011,
			release: "2011-12-sc-bfc",
			ladToDataZones: { S12000049: ["S01010206"] },
		},
		{
			boundaryYear: 2021,
			release: "2021-ni",
			ladToDataZones: { N09000003: ["N20000001", "N20000002"] },
		},
		{
			boundaryYear: 2022,
			release: "2022-sc-bfc",
			ladToDataZones: { S12000049: ["S01013561", "S01013562"] },
		},
	],
};

describe("data zone council lookup", () => {
	it("reads a council's zones from the newest release that lists it", () => {
		const releases = parseDataZoneLadMappings(lookup);
		expect(councilDataZones(releases, "S12000049")).toEqual({
			boundaryYear: 2022,
			zones: ["S01013561", "S01013562"],
		});
		expect(councilDataZones(releases, "N09000003")).toEqual({
			boundaryYear: 2021,
			zones: ["N20000001", "N20000002"],
		});
	});

	it("has no zones for a council no nation publishes them for", () => {
		expect(
			councilDataZones(parseDataZoneLadMappings(lookup), "E08000025"),
		).toBeUndefined();
	});

	it("refuses a malformed lookup", () => {
		expect(() =>
			parseDataZoneLadMappings({
				version: 1,
				releases: [{ release: 1 }],
			}),
		).toThrow("Invalid data zone/LAD mapping");
	});
});
