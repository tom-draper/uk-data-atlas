import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LegendPanel from "@/components/LegendPanel";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import { EMPTY_BOUNDARY_DATA } from "@/lib/data/boundaries/propertyLoader";
import type { Datasets, LocalElectionDataset } from "@/lib/types";
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

function renderLegend() {
	return renderToStaticMarkup(
		createElement(LegendPanel, {
			activeDataset: dataset,
			activeViz: {
				datasetId: dataset.id,
				datasetType: dataset.type,
				datasetYear: dataset.year,
			},
			mapOptions: DEFAULT_MAP_OPTIONS,
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
