import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LegendPanel from "@/components/LegendPanel";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { EMPTY_BOUNDARY_DATA } from "@/lib/data/boundaries/propertyLoader";
import type { Dataset, Datasets, LocalElectionDataset } from "@/lib/types";
import type { LegendAggregates } from "@/components/legend/types";

const state = vi.hoisted(() => ({ aggregates: {} as LegendAggregates }));
vi.mock("@/components/legend/legendData", async (importOriginal) => ({
	...(await importOriginal<
		typeof import("@/components/legend/legendData")
	>()),
	useLegendAggregates: () => state.aggregates,
}));

const dataset: LocalElectionDataset = {
	id: "local-election-2024",
	type: "localElection",
	year: 2024,
	boundaryType: "ward",
	boundaryYear: 2024,
	partyInfo: [],
	results: {},
	data: {
		E1: {
			ladCode: "E2",
			ladName: "Test",
			wardCode: "E1",
			wardName: "Test",
			totalVotes: 100,
			turnoutPercent: 50,
			electorate: 200,
			partyVotes: { LAB: 100 },
		},
	},
};

function renderLegend(
	activeDataset: Dataset = dataset,
	mapOptions = DEFAULT_MAP_OPTIONS,
) {
	return renderToStaticMarkup(
		createElement(LegendPanel, {
			activeDataset,
			activeViz: {
				datasetId: activeDataset.id,
				datasetType: activeDataset.type,
				datasetYear: activeDataset.year,
			},
			mapOptions,
			onMapOptionsChange: () => {},
			mapManager: null,
			boundaryData: EMPTY_BOUNDARY_DATA,
			location: null,
			datasets: {} as Datasets,
		}),
	);
}

describe("legend loading", () => {
	beforeEach(() => {
		state.aggregates = {};
	});
	it("holds the entire election legend while party totals are loading", () => {
		expect(renderLegend()).toBe("");
	});
	it("shows party items and the metric toggle together once totals are ready", () => {
		state.aggregates = {
			localElection: { 2024: { partyVotes: { LAB: 100 } } },
		};
		const html = renderLegend();
		expect(html).toContain("category-legend-LAB");
		expect(html).toContain("Turnout");
	});
	it("waits for the active year even when another year has totals", () => {
		state.aggregates = {
			localElection: { 2023: { partyVotes: { LAB: 100 } } },
		};
		expect(renderLegend()).toBe("");
	});
});

describe("waste legend", () => {
	const waste: Extract<Dataset, { type: "waste" }> = {
		id: "waste2025",
		type: "waste",
		year: 2025,
		boundaryType: "localAuthority",
		boundaryYear: 2025,
		data: {},
	};
	it("shows waste measures alongside the population toggle", () => {
		const html = renderLegend(waste);
		expect(html).toContain("Collected");
		expect(html).toContain("Recycled");
		expect(html).toContain("Recycling %");
		expect(html).toContain("Per pop.");
	});
	it("uses a percentage legend and hides population scaling for recycling share", () => {
		const html = renderLegend(waste, {
			...DEFAULT_MAP_OPTIONS,
			waste: {
				...DEFAULT_MAP_OPTIONS.waste,
				metric: "recyclingShare",
				colorRange: { min: 0, max: 100 },
			},
		});
		expect(html).toContain("100.0% recycled");
		expect(html).not.toContain("Per pop.");
		expect(html).not.toContain("per 100k");
	});
});
