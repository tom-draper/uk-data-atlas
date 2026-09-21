import { describe, expect, it } from "vitest";
import { resolveIndicatorValue } from "@/components/IndicatorChart";
import type { IndicatorDataset } from "@/lib/types/indicator";

const dataset: IndicatorDataset = {
	id: "businessActivity2025",
	type: "businessActivity",
	year: 2025,
	boundaryType: "localAuthority",
	boundaryYear: 2025,
	data: {},
};

describe("resolveIndicatorValue", () => {
	it("uses the active map hover value when an area cannot be matched directly", () => {
		const hoveredWard = {
			type: "ward",
			code: "E05000001",
			name: "Example ward",
			data: { value: 42 },
		} as any;

		expect(resolveIndicatorValue(dataset, hoveredWard, true)).toBe(42);
		expect(
			resolveIndicatorValue(dataset, hoveredWard, false),
		).toBeUndefined();
	});
});
