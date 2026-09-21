import { describe, expect, it } from "vitest";
import { toChartTitleCase } from "@/lib/helpers/titleCase";

describe("toChartTitleCase", () => {
	it("capitalises ordinary chart words", () => {
		expect(toChartTitleCase("population density [2022]")).toBe(
			"Population Density [2022]",
		);
	});

	it("preserves acronyms, symbols, and numeric labels", () => {
		expect(toChartTitleCase("NHS waiting times [2024/25]")).toBe(
			"NHS Waiting Times [2024/25]",
		);
		expect(toChartTitleCase("GCSE performance [2024/25]")).toBe(
			"GCSE Performance [2024/25]",
		);
		expect(toChartTitleCase("air quality, NO₂")).toBe("Air Quality, NO₂");
	});

	it("separates internal camel-case labels", () => {
		expect(toChartTitleCase("localElection2024")).toBe(
			"Local Election2024",
		);
	});
});
