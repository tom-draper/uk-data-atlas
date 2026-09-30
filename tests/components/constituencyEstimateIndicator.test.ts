import { describe, expect, it } from "vitest";
import { isConstituencyEstimate } from "@/components/ConstituencyEstimateIndicator";
import type { SelectedArea } from "@/lib/types";

const ward: SelectedArea = {
	type: "ward",
	code: "E05000001",
	name: "Example ward",
	data: null,
};

describe("isConstituencyEstimate", () => {
	it("marks ward data resolved through a constituency", () => {
		expect(isConstituencyEstimate(ward, true)).toBe(true);
	});

	it("does not mark a ward without a resolved constituency record", () => {
		expect(isConstituencyEstimate(ward, false)).toBe(false);
	});

	it("does not label a constituency's own figure as an estimate", () => {
		expect(
			isConstituencyEstimate(
				{
					type: "constituency",
					code: "E14000001",
					name: "Example constituency",
					data: null,
				},
				true,
			),
		).toBe(false);
	});
});
