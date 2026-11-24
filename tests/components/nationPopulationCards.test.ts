import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AgeDistribution from "@/components/datasets/population/population-estimates/population/age/AgeDistribution";
import PopulationDensityChart from "@/components/datasets/population/population-estimates/population/density/PopulationDensityChart";
import Gender from "@/components/datasets/population/population-estimates/population/gender/Gender";
import {
	formatNationCoverage,
	nationAgesMessage,
	type NationPopulationState,
} from "@/lib/hooks/useNationPopulation";
import type { SelectedArea } from "@/lib/types/areas";

const dataset = {
	id: "population",
	type: "population",
	year: 2022,
	boundaryType: "ward",
	boundaryYear: 2023,
	coverageCountries: ["GB-ENG", "GB-WLS"],
	data: {},
} as never;

const area = (
	type: SelectedArea["type"],
	code: string,
	boundaryYear?: number,
) => ({ type, code, name: code, data: null, boundaryYear }) as SelectedArea;

const renderGender = (selectedArea: SelectedArea | null) =>
	renderToStaticMarkup(
		createElement(Gender, {
			dataset,
			aggregatedData: null,
			selectedArea,
			activeViz: {
				datasetId: "",
				datasetType: "population",
				datasetYear: 0,
			} as never,
			setActiveViz: () => {},
		}),
	);

describe("gender card outside the dataset's nations", () => {
	it("keeps the dataset's year for an English area", () => {
		const html = renderGender(area("ward", "E05000026"));
		expect(html).toContain("Gender [2022]");
		expect(html).not.toContain("Scotland");
	});

	it("says a Scottish ward is not published rather than showing a 2022 figure", () => {
		const html = renderGender(area("ward", "S13002781"));
		expect(html).toContain("Gender [Scotland]");
		expect(html).toContain("Not published in this form for Scotland");
		expect(html).toContain(
			"Here: Scotland. Elsewhere: England &amp; Wales, mid-2022.",
		);
	});

	it("waits for a council's own estimate without claiming England's year", () => {
		const html = renderGender(area("localAuthority", "S12000049", 2023));
		expect(html).not.toContain("[2022]");
		expect(html).not.toContain("No data available");
		expect(html).toContain("Here: Scotland");
	});

	it("names Northern Ireland for an NI ward", () => {
		const html = renderGender(area("ward", "N08000101"));
		expect(html).toContain(
			"Not published in this form for Northern Ireland",
		);
	});
});

const renderAge = (selectedArea: SelectedArea | null) =>
	renderToStaticMarkup(
		createElement(AgeDistribution, {
			dataset,
			aggregatedData: null,
			selectedArea,
			activeViz: {
				datasetId: "",
				datasetType: "population",
				datasetYear: 0,
			} as never,
			setActiveViz: () => {},
		}),
	);

describe("age card outside the dataset's nations", () => {
	it("keeps the dataset's year for an English area", () => {
		expect(renderAge(area("ward", "E05000026"))).toContain(
			"Age Distribution [2022]",
		);
	});

	it("says a Northern Irish ward is not published", () => {
		const html = renderAge(area("ward", "N08000101"));
		expect(html).toContain("Age Distribution [Northern Ireland]");
		expect(html).toContain(
			"Not published in this form for Northern Ireland",
		);
	});

	it("waits for a data zone's own estimate", () => {
		const html = renderAge(area("dataZone", "S01006506", 2022));
		expect(html).not.toContain("[2022]");
		expect(html).not.toContain("No data available");
	});
});

const renderDensity = (selectedArea: SelectedArea | null) =>
	renderToStaticMarkup(
		createElement(PopulationDensityChart, {
			dataset,
			aggregatedData: null,
			boundaryData: { ward: {} } as never,
			selectedArea,
			activeViz: {
				datasetId: "",
				datasetType: "population",
				datasetYear: 0,
			} as never,
			setActiveViz: () => {},
		}),
	);

describe("density card outside the dataset's nations", () => {
	it("keeps the dataset's year for an English area", () => {
		expect(renderDensity(area("ward", "E05000026"))).toContain(
			"Population Density [2022]",
		);
	});

	it("says a Scottish ward is not published", () => {
		const html = renderDensity(area("ward", "S13002781"));
		expect(html).toContain("Population Density [Scotland]");
		expect(html).toContain("Not published in this form for Scotland");
	});

	it("waits for a council's estimate and density", () => {
		const html = renderDensity(area("localAuthority", "N09000003", 2023));
		expect(html).not.toContain("[2022]");
		expect(html).not.toContain("No data available");
	});
});

describe("labels for a nation's population figure", () => {
	const state = (
		population: Partial<NonNullable<NationPopulationState["population"]>>,
		note: string,
	): NationPopulationState => ({
		nation: "Scotland",
		status: "ready",
		target: null,
		source: "",
		note,
		population: {
			period: null,
			datasetId: null,
			kind: null,
			total: null,
			males: null,
			females: null,
			ages: null,
			...population,
		},
	});

	it("names a census count by its census year, not as an estimate", () => {
		const census = state(
			{ period: "2022", kind: "census", total: 812 },
			"Scotland, Census 2022",
		);
		expect(formatNationCoverage(census, undefined, 2022)).toBe(
			"Here: Scotland, Census 2022. Elsewhere: England & Wales, mid-2022.",
		);
		expect(nationAgesMessage(census)).toBe(
			"Not split by sex or age here. Total 812 (Scotland, Census 2022)",
		);
	});

	it("names an estimate by its mid-year", () => {
		const estimate = state(
			{ period: "2024", kind: "estimate", total: 650_300 },
			"Scotland, Office for National Statistics mid-2024 estimate",
		);
		expect(formatNationCoverage(estimate, undefined, 2022)).toBe(
			"Here: Scotland, mid-2024. Elsewhere: England & Wales, mid-2022.",
		);
		expect(nationAgesMessage(estimate)).toContain("Total 650,300");
	});
});
