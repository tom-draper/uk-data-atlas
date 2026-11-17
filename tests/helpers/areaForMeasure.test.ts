import { describe, expect, it } from "vitest";
import { areaForMeasure } from "@/lib/measures/area";
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
