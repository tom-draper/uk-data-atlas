import { describe, expect, it } from "vitest";
import { areaForMeasure, wardsWithin } from "@/lib/measures/area";
import type { SelectedArea } from "@/lib/types";

const area = (type: SelectedArea["type"], code: string) =>
	({ type, code, name: code, data: {} }) as unknown as SelectedArea;

describe("areaForMeasure", () => {
	it("is undefined with nothing selected", () => {
		expect(
			areaForMeasure(null, "localAuthority", 2024, undefined),
		).toBeUndefined();
	});

	it("keeps the code of an area at the measure's geography", () => {
		expect(
			areaForMeasure(area("ward", "W1"), "ward", 2024, undefined),
		).toBe("W1");
	});

	it("has no area for a geography the measure is not held at", () => {
		expect(
			areaForMeasure(area("ward", "W1"), "region", 2024, undefined),
		).toBeUndefined();
	});

	it("maps a local authority into the measure's boundary year", () => {
		const getCodeForYear = (_type: string, code: string, year: number) =>
			`${code}@${year}`;
		expect(
			areaForMeasure(
				area("localAuthority", "E1"),
				"localAuthority",
				2024,
				{
					getCodeForYear,
				},
			),
		).toBe("E1@2024");
	});

	it("shows a ward's local authority where the measure is held by authority", () => {
		expect(
			areaForMeasure(area("ward", "W1"), "localAuthority", 2024, {
				getLadForWard: () => "E9",
				getCodeForYear: (_type, code) => code,
			}),
		).toBe("E9");
	});
});

describe("wardsWithin", () => {
	const mapper = {
		getWardsForLad: (lad: string) => [`${lad}-w1`, `${lad}-w2`],
		getWardsForConstituency: (pcon: string) => [`${pcon}-w1`],
		getCodeForYear: (_type: string, code: string, year: number) =>
			code.endsWith("w2") ? `${code}@${year}` : undefined,
	};

	it("lists an authority's wards under the codes the measure holds", () => {
		expect(
			wardsWithin(area("localAuthority", "E1"), "ward", 2021, mapper),
		).toEqual(["E1-w1", "E1-w2@2021"]);
	});

	it("lists a constituency's wards", () => {
		expect(
			wardsWithin(area("constituency", "P1"), "ward", 2021, mapper),
		).toEqual(["P1-w1"]);
	});

	it("is empty until the membership can be read, and undefined where it does not apply", () => {
		expect(
			wardsWithin(area("localAuthority", "E1"), "ward", 2021, undefined),
		).toEqual([]);
		expect(
			wardsWithin(area("ward", "W1"), "ward", 2021, mapper),
		).toBeUndefined();
		expect(
			wardsWithin(
				area("localAuthority", "E1"),
				"localAuthority",
				2021,
				mapper,
			),
		).toBeUndefined();
		expect(wardsWithin(null, "ward", 2021, mapper)).toBeUndefined();
	});
});
