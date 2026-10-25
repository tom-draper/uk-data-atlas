import { describe, expect, it } from "vitest";
import {
	compareDistricts,
	compilePostcodeDistricts,
	type SourceDistrict,
} from "@/lib/places/postcodes";

const column = (codes: string[], area: number[]) => ({ codes, area });

const district = (
	name: string,
	postcodes: string[],
	at: number,
	terminated = postcodes.map(() => 0),
): SourceDistrict => ({
	district: name,
	postcodes,
	grid: postcodes.flatMap((_, i) => [at + i * 100, at]),
	terminated,
	largeUser: postcodes.map((_, i) => (i === 0 ? "1" : "0")).join(""),
	areas: {
		localAuthority: column(
			["E08000001"],
			postcodes.map(() => 0),
		),
		ward: {
			codes: ["W1", "W2"],
			area: postcodes.map((_, i) => (i === 0 ? -2 : 1)),
			several: { 0: [[0, "edge", 0]] },
		},
		constituency: column(
			["C1"],
			postcodes.map((_, i) => (i === 1 ? -1 : 0)),
		),
	},
});

describe("compilePostcodeDistricts", () => {
	const compiled = compilePostcodeDistricts(
		[
			district(
				"LS6",
				["LS61AA", "LS61AB", "LS62AA", "LS63ZZ"],
				1000,
				[0, 0, 0, 202001],
			),
			district("LS1", ["LS11AA"], 5000),
			district("LS99", ["LS991AA"], 9000, [201001]),
		],
		(easting, northing) => [easting / 1000, northing / 1000],
	);

	it("counts live postcodes by sector and area", () => {
		expect(compiled.LS6).toMatchObject({
			live: 3,
			terminated: 1,
			largeUser: 1,
			sectors: [
				["LS6 1", 2],
				["LS6 2", 1],
			],
			bbox: [1, 1, 1.2, 1],
			example: "LS6 1AA",
		});
		expect(compiled.LS6!.areas).toEqual({
			localAuthority: [["E08000001", 3]],
			// A postcode on an edge counts towards the first area it touches.
			ward: [
				["W2", 2],
				["W1", 1],
			],
			constituency: [["C1", 2]],
		});
	});

	it("leaves out districts with no live postcodes", () => {
		expect(Object.keys(compiled).sort()).toEqual(["LS1", "LS6"]);
		expect(compiled.LS6!.nearby).toEqual(["LS1"]);
	});
});

describe("compareDistricts", () => {
	it("orders districts by letters, number, then final letter", () => {
		expect(
			["LS10", "E1W", "LS2", "E1", "EC1A", "LS1"].sort(compareDistricts),
		).toEqual(["E1", "E1W", "EC1A", "LS1", "LS2", "LS10"]);
	});
});
