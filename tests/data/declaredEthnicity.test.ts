import { describe, expect, it } from "vitest";
import {
	ETHNICITY_CODES,
	ethnicity,
	statisticsOf,
} from "@uk-data-atlas/datasets";
import { declaredMemberCodes } from "@uk-data-atlas/measures";
import {
	CATEGORY_CHART_DEFINITIONS,
	declaredCategories,
} from "@/lib/datasets/categories";

describe("ethnicity's breakdown card", () => {
	const definition = CATEGORY_CHART_DEFINITIONS.find(
		({ type }) => type === "ethnicity",
	)!;
	const { breakdown } = definition.chart;

	it("is declared as a categorical dataset, keyed like a declared card", () => {
		expect(definition.legendKind).toBe("category");
		expect(definition.chart.key).toBe("population-ethnicity");
	});

	it("splits usual residents across every ethnic group by its stored member code", () => {
		expect(breakdown?.request.measure).toBe("usual-residents");
		expect(breakdown?.dimension).toBe("ethnic-group");
		expect(breakdown?.parts).toHaveLength(
			Object.keys(ETHNICITY_CODES).length,
		);
	});

	it("asks for codes the stored measure holds, not the census numbers", () => {
		const stored = new Set(
			declaredMemberCodes(statisticsOf(ethnicity))
				.get("ethnic-group")!
				.values(),
		);
		for (const part of breakdown!.parts) {
			expect(stored).toContain(part.code);
			expect(part.code).not.toMatch(/^\d+$/);
		}
	});

	it("has no member for a total, so the groups sum to it", () => {
		expect(breakdown?.total).toBeUndefined();
		expect(breakdown?.order).toBe("largest");
		expect(breakdown?.legendFilter).toBe(true);
	});

	it("colours every group and labels it by name", () => {
		for (const part of breakdown!.parts) {
			expect(part.color).toMatch(/^#[0-9a-f]{6}$/i);
			expect(Object.keys(ETHNICITY_CODES)).toContain(part.label);
			expect(
				declaredCategories("ethnicity")?.colors[part.label as string],
			).toBe(part.color);
		}
	});
});
