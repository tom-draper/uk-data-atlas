import { describe, expect, it } from "vitest";
import { ethnicityDefinition } from "@/lib/datasets/ethnicity";
import { ETHNICITY_CODES } from "@uk-data-atlas/datasets";

describe("ethnicity's breakdown card", () => {
	const { breakdown } = ethnicityDefinition.chart;

	it("splits usual residents across every ethnic group by its census code", () => {
		expect(breakdown?.request.measure).toBe("usual-residents");
		expect(breakdown?.dimension).toBe("ethnic-group");
		expect(breakdown?.parts.map((part) => part.code)).toEqual(
			Object.values(ETHNICITY_CODES),
		);
	});

	it("has no member for a total, so the groups sum to it", () => {
		expect(breakdown?.total).toBeUndefined();
		expect(breakdown?.order).toBe("largest");
		expect(breakdown?.legendFilter).toBe("ethnicity");
	});

	it("colours every group and labels it by name", () => {
		for (const part of breakdown!.parts) {
			expect(part.color).toMatch(/^#[0-9a-f]{6}$/i);
			expect(Object.keys(ETHNICITY_CODES)).toContain(part.label);
		}
	});
});
