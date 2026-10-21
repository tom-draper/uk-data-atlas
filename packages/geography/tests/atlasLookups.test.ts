import { describe, expect, it } from "vitest";
import { compileAtlasLookups, type LookupResolver } from "../src";

const vintages = {
	ward: { 2024: "2024-12-uk-bgc" },
	lsoa: { 2021: "2021-12-ew-bgc-v5" },
	parish: { 2024: "2024-12-ew-bgc" },
	localAuthority: { 2025: "2025-05-uk-bgc-v2" },
	constituency: { 2024: "2024-07-uk-bgc" },
};

const resolver = (missing: string): LookupResolver => ({
	hasAreaRelease: (geography, release) =>
		`${geography}/${release}` !== missing,
	areaCodes: () => [],
	crosswalkSummaries: () => [],
	crosswalk: () => undefined,
	sameArea: () => undefined,
	successorArea: () => undefined,
});

describe("compiling the atlas's lookups", () => {
	it("refuses a release the atlas draws but the API does not compile", () => {
		expect(() =>
			compileAtlasLookups(resolver("parish/2024-12-ew-bgc"), vintages),
		).toThrow(
			"parish/2024-12-ew-bgc is drawn by the atlas but not compiled by the API.",
		);
	});
});
