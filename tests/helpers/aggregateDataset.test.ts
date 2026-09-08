import { describe, expect, it, vi } from "vitest";
import { aggregateDataset } from "@/lib/helpers/aggregateDataset";

describe("aggregateDataset", () => {
	it("waits for a map manager before calculating an aggregate", () => {
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

		expect(aggregate).toBeNull();
	});

	it("uses selected-location aggregates without boundary data", () => {
		const aggregate = {
			partyVotes: { LAB: 10 },
			electorate: 20,
			totalVotes: 10,
		};
		const datasets = {
			"2024": {
				id: "localElection2024",
				type: "localElection",
				year: 2024,
				boundaryYear: 2024,
				boundaryType: "ward",
				data: {},
				locationAggregate: aggregate,
			},
		} as any;

		expect(
			aggregateDataset(
				{
					datasets,
					boundaryType: "ward",
					calculateStats: vi.fn(),
				},
				null,
				{} as any,
				"Greater Manchester",
			),
		).toEqual({ 2024: aggregate });
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

		const first = aggregateDataset(
			config,
			mapManager,
			boundaryData,
			"London",
		);
		const second = aggregateDataset(
			config,
			mapManager,
			boundaryData,
			"London",
		);

		expect(calculateStats).toHaveBeenCalledTimes(1);
		expect(second).toBe(first);

		aggregateDataset(config, mapManager, boundaryData, "Manchester");
		expect(calculateStats).toHaveBeenCalledTimes(2);
	});

	it("gives a replacement location slice a fresh aggregator cache identity", () => {
		const mapManager = {} as any;
		const boundaryData = {
			localAuthority: {
				2025: { type: "FeatureCollection", features: [] },
			},
		} as any;
		const calculateStats = vi.fn(() => ({ total: 1 }));
		const first = {
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
		const replacement = {
			"2025": { ...first["2025"], data: { E2: 2 } },
		} as any;

		for (const datasets of [first, replacement]) {
			aggregateDataset(
				{
					datasets,
					boundaryType: "localAuthority",
					calculateStats,
				},
				mapManager,
				boundaryData,
				"Lancashire",
			);
		}

		expect(calculateStats).toHaveBeenCalledTimes(2);
		const calls = calculateStats.mock.calls as unknown as unknown[][];
		expect(calls[0]![4]).not.toBe(calls[1]![4]);
	});
});
