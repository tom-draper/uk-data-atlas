import { describe, expect, it, vi } from "vitest";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";

describe("aggregateDataset", () => {
	it("uses the complete precompiled aggregate without requiring a map manager", () => {
		const datasets = {
			"2022": {
				id: "population2022",
				type: "population",
				year: 2022,
				boundaryYear: 2023,
				boundaryType: "ward",
				data: {},
			},
		} as any;

		const aggregate = aggregateDataset(
			{
				datasets,
				boundaryType: "ward",
				calculateStats: vi.fn(),
			},
			null,
			{} as any,
			"Greater Manchester",
		);

		expect(aggregate?.["2022"]).toMatchObject({
			populationStats: { total: expect.any(Number) },
		});
	});

	it("shares an aggregate requested by multiple consumers", () => {
		const mapManager = {} as any;
		const boundaryData = {
			localAuthority: {
				2025: { type: "FeatureCollection", features: [] },
			},
		} as any;
		const datasets = {
			"2025": {
				id: "example",
				type: "custom",
				kind: "choropleth",
				year: 2025,
				boundaryYear: 2025,
				boundaryType: "localAuthority",
				dataColumn: "Example",
				data: { E1: 1 },
			},
		} as any;
		const calculateStats = vi.fn(() => ({ total: 1 }));
		const config = {
			datasets,
			boundaryType: "localAuthority" as const,
			calculateStats,
		};

		const first = aggregateDataset(config, mapManager, boundaryData, "London");
		const second = aggregateDataset(config, mapManager, boundaryData, "London");

		expect(calculateStats).toHaveBeenCalledTimes(1);
		expect(second).toBe(first);

		aggregateDataset(config, mapManager, boundaryData, "Manchester");
		expect(calculateStats).toHaveBeenCalledTimes(2);
	});
});
