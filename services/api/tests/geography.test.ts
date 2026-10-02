import assert from "node:assert/strict";
import test from "node:test";
import { isGeographyKind } from "../src/geography";

test("recognises published geographies awaiting relationship coverage", () => {
	for (const geography of [
		"localHealthBoard",
		"majorTownAndCity",
		"nationalPark",
		"nhsEnglandRegion",
		"travelToWorkArea",
	]) {
		assert.equal(isGeographyKind(geography), true);
	}
});
