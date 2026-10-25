import { describe, expect, it } from "vitest";
import { areaCodeAt } from "@/lib/places/postcodes";
import {
	compactUnit,
	postcodeHref,
	readPostcodeUnit,
	type DistrictRow,
} from "@/lib/places/postcodeUnit";

const row = (
	postcode: string,
	easting: number | null,
	terminated = 0,
): DistrictRow => ({
	postcode,
	easting,
	northing: easting === null ? null : 400000,
	quality: "1",
	country: "E",
	introduced: 198001,
	terminated,
	largeUser: "0",
});

const releases = {
	areas: {
		localAuthority: "localAuthority/a",
		ward: "ward/a",
		constituency: "constituency/a",
	},
	deprivation: { imd: "lsoa/2021", wimd: "lsoa/2011", simd: "dataZone/2011" },
};

describe("readPostcodeUnit", () => {
	const rows = [
		row("WA35AA", 1000),
		row("WA35AB", 1010),
		row("WA35AD", 1020, 201503),
		row("WA35DW", 1030),
		row("WA35EX", null),
	];
	const columns: Record<string, Parameters<typeof areaCodeAt>[0]> = {
		"localAuthority/a": { codes: ["E06000007"], area: [0, 0, 0, 0, -1] },
		"ward/a": {
			codes: ["E05000001", "E05000002"],
			area: [0, 0, 0, -2, -1],
			several: { "3": [[1, "boundary", 0]] as const },
		},
		"lsoa/2021": { codes: ["E01000001"], area: [0, 0, 0, 0, -1] },
	};
	const read = (at: number) =>
		readPostcodeUnit(
			"WA3",
			rows,
			at,
			(release) => areaCodeAt(columns[release], at),
			releases,
		);

	it("reads its areas, taking the first where it lies on an edge", () => {
		const unit = read(3);
		expect(unit).toMatchObject({
			postcode: "WA3 5DW",
			sector: "WA3 5",
			areas: { localAuthority: "E06000007", ward: "E05000002" },
			neighbourhoods: { imd: "E01000001" },
		});
		expect(unit.areas.constituency).toBeUndefined();
		expect(unit.lngLat).toHaveLength(2);
	});

	it("lists the nearest live postcodes, skipping terminated ones", () => {
		const unit = read(3);
		expect(unit.nearby).toEqual(["WA3 5AB", "WA3 5AA"]);
	});

	it("leaves a postcode with no grid reference unplaced", () => {
		const unit = read(4);
		expect(unit.grid).toBeUndefined();
		expect(unit.nearby).toEqual([]);
		expect(unit.areas).toEqual({});
	});
});

describe("postcode forms", () => {
	it("reads a unit postcode however it is typed", () => {
		expect(compactUnit(" wa3 5dw ")).toBe("WA35DW");
		expect(compactUnit("WA3 5")).toBeUndefined();
	});

	it("links a postcode by its outward and inward codes", () => {
		expect(postcodeHref("SW1A 1AA")).toBe("/places/postcodes/SW1A/1AA");
	});
});
