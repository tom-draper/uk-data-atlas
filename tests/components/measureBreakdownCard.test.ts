import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MeasureBreakdownChart from "@/components/measures/MeasureBreakdownChart";
import { MeasureBreakdownCard } from "@/components/measures/MeasureBreakdownCard";
import type { SelectedArea } from "@/lib/types/areas";

const render = (
	scope: string[] | null,
	area: string | null = null,
	emptyMessage?: string,
) =>
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
			emptyMessage,
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

describe("breakdown card outside the dataset's nations", () => {
	it("says what a nation does not publish instead of that data is missing", () => {
		const html = render(
			[],
			"S12000049",
			"Not published in this form for Scotland",
		);
		expect(html).toContain("Not published in this form for Scotland");
		expect(html).not.toContain("No data available");
	});

	const renderChart = (code: string | null, location?: string) =>
		renderToStaticMarkup(
			createElement(MeasureBreakdownChart, {
				breakdown: {
					request: {
						measure: "usual-residents",
						datasetId: "ethnicity",
						geography: "localAuthority",
						boundaryYear: 2023,
					},
					dimension: "ethnic-group",
					parts: [{ code: "white-british", color: "#000" }],
					heading: "Ethnicity",
					period: "2021",
					source: "Census 2021",
				},
				boundaryData: {},
				availableDatasets: {
					2021: {
						id: "ethnicity",
						type: "ethnicity",
						coverageCountries: ["GB-ENG", "GB-WLS"],
					},
				},
				selectedArea: code
					? ({
							type: "localAuthority",
							code,
							name: code,
							data: null,
							boundaryYear: 2023,
						} as SelectedArea)
					: null,
				location,
				year: 2021,
				setActiveViz: () => {},
			} as never),
		);

	it.each([
		["S12000049", "Scotland"],
		["N09000003", "Northern Ireland"],
	])("never gives %s the 2021 census year", (code, nation) => {
		const html = renderChart(code);
		expect(html).toContain(`Ethnicity [${nation}]`);
		expect(html).not.toContain("[2021]");
		expect(html).toContain(
			`Here: ${nation}, not published. Elsewhere: England &amp; Wales, 2021.`,
		);
	});

	it("keeps the census year for an English authority", () => {
		const html = renderChart("E08000025");
		expect(html).toContain("Ethnicity [2021]");
		expect(html).not.toContain("not published");
	});

	it.each([
		["Glasgow", "Scotland"],
		["Central Belt", "Scotland"],
		["Belfast", "Northern Ireland"],
	])("reads %s picked from Places as %s", (location, nation) => {
		const html = renderChart(null, location);
		expect(html).toContain(`Ethnicity [${nation}]`);
		expect(html).not.toContain("No data available");
	});

	it("keeps the census year for an English place picked from Places", () => {
		expect(renderChart(null, "Birmingham")).toContain("Ethnicity [2021]");
	});
});
