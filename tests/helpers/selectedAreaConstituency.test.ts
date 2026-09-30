import { describe, expect, it } from "vitest";
import { selectedAreaConstituencyRecord } from "@/lib/helpers/selectedAreaConstituency";
import type { SelectedArea } from "@/lib/types";

const ward: SelectedArea = {
	type: "ward",
	code: "W1",
	name: "Example ward",
	data: null,
};

describe("selectedAreaConstituencyRecord", () => {
	it("returns the best-fit constituency record for a ward", () => {
		expect(
			selectedAreaConstituencyRecord(
				{ C1: { value: 42 } },
				ward,
				{ getConstituencyForWard: () => "C1" },
				2024,
			),
		).toEqual({ value: 42 });
	});

	it("maps a selected constituency to the dataset boundary vintage", () => {
		expect(
			selectedAreaConstituencyRecord(
				{ C2024: { value: 42 } },
				{
					type: "constituency",
					code: "C2019",
					name: "Example constituency",
					data: null,
				},
				{
					getCodeForYear: (_type, code, year) =>
						code === "C2019" && year === 2024 ? "C2024" : undefined,
				},
				2024,
			),
		).toEqual({ value: 42 });
	});
});
