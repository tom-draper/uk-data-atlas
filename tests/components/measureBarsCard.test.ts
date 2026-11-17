import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MeasureBarsCard } from "@/components/measures/MeasureBarsCard";

const render = (scope: string[] | null) =>
	renderToStaticMarkup(
		createElement(MeasureBarsCard, {
			request: {
				measure: "life-expectancy",
				geography: "localAuthority",
				boundaryYear: 2024,
				datasetId: "life-expectancy",
			},
			scope,
			area: null,
			dimension: "sex",
			bars: [{ code: "male", label: "M" }],
			combine: "mean",
			ramp: { low: "#dcfce7", high: "#15803d" },
			digits: 1,
			heading: "Life Expectancy [2022-2024]",
			isActive: false,
			onClick: () => {},
		}),
	);

describe("MeasureBarsCard", () => {
	it("does not wait for an area before it draws", () => {
		const html = render(["E1", "E2"]);
		expect(html).toContain("Life Expectancy [2022-2024]");
		expect(html).not.toContain("Select an area");
	});

	it("waits while the areas in scope are unknown", () => {
		expect(render(null)).not.toContain("No data available");
	});

	it("says so when nothing is in scope", () => {
		expect(render([])).toContain("No data available");
	});
});
