import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MeasureBreakdownCard } from "@/components/measures/MeasureBreakdownCard";

const render = (scope: string[] | null, area: string | null = null) =>
	renderToStaticMarkup(
		createElement(MeasureBreakdownCard, {
			request: {
				measure: "people-in-employment",
				geography: "localAuthority",
				boundaryYear: 2025,
				datasetId: "travel-to-work",
			},
			scope,
			area,
			dimension: "travel-method",
			total: "total",
			parts: [{ code: "car", color: "#ef4444" }],
			accent: "car",
			heading: "Travel to Work [2021]",
			isActive: false,
			onClick: () => {},
		}),
	);

describe("MeasureBreakdownCard", () => {
	it("no longer asks for an area before it draws anything", () => {
		const html = render(["E1", "E2"]);
		expect(html).toContain("Travel To Work [2021]");
		expect(html).not.toContain("Select an area");
	});

	it("waits while the areas in scope are unknown", () => {
		expect(render(null)).not.toContain("No data available");
	});

	it("says so when nothing is in scope", () => {
		expect(render([])).toContain("No data available");
	});
});
