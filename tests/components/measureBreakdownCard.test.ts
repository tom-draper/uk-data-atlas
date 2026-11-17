import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MeasureBreakdownCard } from "@/components/measures/MeasureBreakdownCard";

const render = (area: string | null) =>
	renderToStaticMarkup(
		createElement(MeasureBreakdownCard, {
			request: {
				measure: "people-in-employment",
				geography: "localAuthority",
				boundaryYear: 2025,
				datasetId: "travel-to-work",
			},
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
	it("asks for an area before it draws anything", () => {
		const html = render(null);
		expect(html).toContain("Travel To Work [2021]");
		expect(html).toContain("Select an area");
	});
});
