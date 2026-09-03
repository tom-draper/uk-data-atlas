import { describe, expect, it, vi } from "vitest";
import { DEFAULT_MAP_OPTIONS } from "@/lib/config/mapOptions";
import {
	renderCustomPoints,
	renderLocalElection,
	renderNumericDataset,
	renderPopulationDensity,
	type MapRenderContext,
} from "@/lib/helpers/mapRendering";
import { childPovertyDefinition } from "@/lib/datasets/childPoverty";

// The recipes only need a MapRenderContext, so they can be exercised without a
// MapLibre map behind them.
const fakeContext = (codeProp = "LAD25CD") => {
	const layerManager = {
		render: vi.fn(),
		updateElectionLayers: vi.fn(),
		updatePartyPercentageLayers: vi.fn(),
		updateColoredLayers: vi.fn(),
		clearPointLayers: vi.fn(),
		clearBoundaryData: vi.fn(),
	};
	const featureBuilder = {
		formatBoundaryGeoJson: vi.fn((features: unknown) => ({
			type: "FeatureCollection",
			features,
		})),
		buildValueFeatures: vi.fn(
			(
				_features: unknown,
				_codeProp: string,
				_valueFor: (code: string, feature: unknown) => number | null,
			) => [],
		),
		buildElectionWinnerFeatures: vi.fn(() => []),
		buildElectionPercentageFeatures: vi.fn(() => []),
		buildPointCollection: vi.fn(() => ({ type: "FeatureCollection", features: [] })),
		getFeatureAreaSqKm: vi.fn(() => 2),
	};
	const eventHandler = { setupEventHandlers: vi.fn() };

	const ctx = {
		layerManager,
		eventHandler,
		featureBuilder,
		codeProp: vi.fn(() => codeProp),
		transformed: vi.fn(
			(_boundary: unknown, _dataset: unknown, _mode: string, build: () => unknown) =>
				build(),
		),
	} as unknown as MapRenderContext;

	return { ctx, layerManager, featureBuilder, eventHandler };
};

const geojson = { type: "FeatureCollection", features: [] } as never;

describe("renderLocalElection", () => {
	const dataset = {
		data: { E05000001: { partyVotes: { LAB: 10, CON: 4 } } },
		results: { E05000001: "LAB" },
		partyInfo: {},
	} as never;

	it("paints winners and binds events against the ward code property", () => {
		const { ctx, layerManager, featureBuilder, eventHandler } = fakeContext("WD25CD");

		renderLocalElection(ctx, geojson, dataset, DEFAULT_MAP_OPTIONS);

		expect(ctx.codeProp).toHaveBeenCalledWith("ward", []);
		expect(featureBuilder.buildElectionWinnerFeatures).toHaveBeenCalledOnce();
		expect(layerManager.updateElectionLayers).toHaveBeenCalledOnce();
		expect(layerManager.updatePartyPercentageLayers).not.toHaveBeenCalled();
		expect(eventHandler.setupEventHandlers).toHaveBeenCalledWith(
			(dataset as { data: unknown }).data,
			"WD25CD",
		);
	});

	it("switches to percentage layers when a party is selected", () => {
		const { ctx, layerManager, featureBuilder } = fakeContext("WD25CD");

		renderLocalElection(ctx, geojson, dataset, {
			...DEFAULT_MAP_OPTIONS,
			localElection: {
				...DEFAULT_MAP_OPTIONS.localElection,
				mode: "percentage",
				selected: "LAB",
			},
		} as never);

		expect(featureBuilder.buildElectionPercentageFeatures).toHaveBeenCalledOnce();
		expect(layerManager.updatePartyPercentageLayers).toHaveBeenCalledOnce();
		expect(layerManager.updateElectionLayers).not.toHaveBeenCalled();
	});

	it("keys the transform cache on the excluded parties", () => {
		const { ctx } = fakeContext("WD25CD");

		renderLocalElection(ctx, geojson, dataset, DEFAULT_MAP_OPTIONS);
		renderLocalElection(ctx, geojson, dataset, {
			...DEFAULT_MAP_OPTIONS,
			localElection: { ...DEFAULT_MAP_OPTIONS.localElection, excluded: ["CON"] },
		} as never);

		const modes = (ctx.transformed as ReturnType<typeof vi.fn>).mock.calls.map(
			(call) => call[2],
		);
		expect(modes).toEqual([
			"localElection:majority:",
			"localElection:majority:CON",
		]);
	});
});

describe("renderPopulationDensity", () => {
	it("divides ward population by the feature's own area", () => {
		const { ctx, featureBuilder } = fakeContext("WD25CD");
		const dataset = {
			data: { E05000001: { males: { "30": 60 }, females: { "30": 40 } } },
		} as never;

		renderPopulationDensity(ctx, geojson, dataset, DEFAULT_MAP_OPTIONS);

		const valueFor = featureBuilder.buildValueFeatures.mock.calls[0][2];
		// 100 people over the fake builder's 2 km².
		expect(valueFor("E05000001", {})).toBe(50);
		expect(valueFor("missing", {})).toBeNull();
	});
});

describe("renderNumericDataset", () => {
	it("reads the configured value key and skips uncovered areas", () => {
		const { ctx, featureBuilder } = fakeContext();
		const dataset = {
			type: "childPoverty",
			boundaryType: "localAuthority",
			data: { E06000001: { childPovertyRate: 25 } },
		} as never;

		renderNumericDataset(
			ctx,
			geojson,
			dataset,
			DEFAULT_MAP_OPTIONS,
			childPovertyDefinition.map!,
		);

		expect(ctx.codeProp).toHaveBeenCalledWith("localAuthority", []);
		const valueFor = featureBuilder.buildValueFeatures.mock.calls[0][2];
		expect(valueFor("E06000001", {})).toBe(25);
		expect(valueFor("missing", {})).toBeNull();
	});
});

describe("renderCustomPoints", () => {
	const dataset = {
		points: [
			{ value: 1, lon: 0, lat: 51 },
			{ value: 2, lon: 0, lat: 52 },
		],
	} as never;

	it("clears the point layers when the filters leave nothing to draw", () => {
		const { ctx, layerManager } = fakeContext();

		renderCustomPoints(ctx, dataset, {
			...DEFAULT_MAP_OPTIONS,
			custom: { ...DEFAULT_MAP_OPTIONS.custom, excludedPointValues: [1, 2] },
		} as never);

		expect(layerManager.clearPointLayers).toHaveBeenCalledOnce();
		expect(layerManager.render).not.toHaveBeenCalled();
	});

	it("draws the points before blanking the choropleth underneath", () => {
		const { ctx, layerManager } = fakeContext();
		const order: string[] = [];
		layerManager.render.mockImplementation(() => order.push("render"));
		layerManager.clearBoundaryData.mockImplementation(() => order.push("clear"));

		renderCustomPoints(ctx, dataset, DEFAULT_MAP_OPTIONS);

		expect(order).toEqual(["render", "clear"]);
	});
});
