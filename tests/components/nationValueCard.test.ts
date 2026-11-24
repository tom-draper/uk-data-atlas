import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ValueCard from "@/components/ValueCard";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { MapOptionsProvider } from "@/lib/context/MapOptionsContext";
import { CHART_DATASET_DEFINITIONS } from "@/lib/datasets";
import type { SelectedArea } from "@/lib/types/areas";

const health = CHART_DATASET_DEFINITIONS.find(
	(definition) => definition.type === "general-health",
)!;

const render = (selectedArea: SelectedArea | null) =>
	renderToStaticMarkup(
		createElement(
			MapOptionsProvider,
			{ value: DEFAULT_MAP_OPTIONS },
			createElement(ValueCard, {
				...(health.chart as object),
				activeDataset: null,
				availableDatasets: {
					2021: {
						id: "general-health",
						type: "general-health",
						year: 2021,
						boundaryType: "lsoa",
						boundaryYear: 2021,
						data: {
							E01000001: {
								metrics: { total: 100, veryGood: 50, good: 30 },
							},
						},
					},
				} as never,
				aggregatedData: null,
				year: 2021,
				selectedArea,
				activeViz: null as never,
				setActiveViz: () => {},
				boundaryData: {} as never,
			}),
		),
	);

const area = (
	type: SelectedArea["type"],
	code: string,
	boundaryYear?: number,
) => ({ type, code, name: code, data: null, boundaryYear }) as SelectedArea;

describe("value card outside the dataset's nations", () => {
	it("keeps the dataset's census year for an English area", () => {
		const html = render(area("lsoa", "E01000001"));
		expect(html).toContain("[2021]");
		expect(html).not.toContain("Scotland");
	});

	it("says a Scottish ward is not published rather than showing a 2021 figure", () => {
		const html = render(area("ward", "S13002781"));
		expect(html).toContain("Not published in this form for Scotland");
		expect(html).toContain("[Scotland]");
		expect(html).not.toContain("[2021]");
		expect(html).toContain("not summed to a ward");
	});

	it("waits for a data zone's own census without claiming England's year", () => {
		const html = render(area("dataZone", "S01006506", 2022));
		expect(html).not.toContain("[2021]");
		expect(html).not.toContain("No data available");
	});

	it("names Northern Ireland for an NI area", () => {
		const html = render(area("ward", "N08000101"));
		expect(html).toContain(
			"Not published in this form for Northern Ireland",
		);
	});
});
