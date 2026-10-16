import { describe, expect, it } from "vitest";
import { geographyName, namedKindName } from "@/lib/places/labels";
import { pageTitle, titleCase } from "@/lib/site";

describe("titleCase", () => {
	it("capitalises words but keeps small words lower case mid-title", () => {
		expect(titleCase("Maps of the UK")).toBe("Maps of the UK");
		expect(titleCase("get a value for a place")).toBe(
			"Get a Value for a Place",
		);
	});

	it("leaves acronyms alone", () => {
		expect(titleCase(geographyName("lsoa"))).toBe("LSOA");
		expect(titleCase("LSOAs ranked")).toBe("LSOAs Ranked");
	});
});

describe("place page titles", () => {
	it("title-cases the geography after an area's code", () => {
		expect(
			pageTitle(
				`Basingstoke and Deane (E07000084), ${titleCase(geographyName("localAuthority"))}`,
			),
		).toBe(
			"Basingstoke and Deane (E07000084), Local Authority - UK Data Atlas",
		);
		expect(titleCase(geographyName("constituency"))).toBe(
			"Westminster Constituency",
		);
		expect(titleCase(geographyName("countyAndUnitaryAuthority"))).toBe(
			"County or Unitary Authority",
		);
	});

	it("title-cases a named place's kind", () => {
		expect(titleCase(namedKindName("combined-authority"))).toBe(
			"Combined Authority",
		);
		expect(titleCase(namedKindName("editorial-grouping"))).toBe(
			"Grouping of Councils",
		);
	});
});
