import { describe, expect, it } from "vitest";
import { sourceDir, sourceInput } from "@uk-data-atlas/datasets";

describe("sourceInput", () => {
	it("resolves a source name and the path inside its folder", () => {
		expect(sourceInput("census-2021-lsoa/data.csv")).toBe(
			sourceDir("census-2021-lsoa", "data.csv"),
		);
	});

	it("returns a path in the boundaries or postcodes root as it is", () => {
		for (const input of [
			"boundaries/data-zone/2021-ni/DZ2021.geojson",
			"postcodes/onspd/ONSPD.csv",
		])
			expect(sourceInput(input)).toBe(input);
	});

	it("rejects a path that names no source", () => {
		expect(() => sourceInput("nowhere/file.csv")).toThrow(
			"does not start with a source name",
		);
	});
});
