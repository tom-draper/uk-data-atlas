import { describe, expect, it } from "vitest";
import { resolveFuelPovertyStats } from "@/components/economics/fuel-poverty/FuelPovertyChart";
import { aggregateFuelPovertyByLad } from "@/lib/helpers/fuelPoverty";
import type {
	AggregatedFuelPovertyData,
	FuelPovertyDataset,
} from "@/lib/types/fuelPoverty";

const dataset: FuelPovertyDataset = {
	id: "fuel-poverty-2024",
	type: "fuelPoverty",
	year: 2024,
	boundaryType: "lsoa",
	boundaryYear: 2011,
	data: {
		E01000001: {
			lsoaCode: "E01000001",
			lsoaName: "Example LSOA",
			householdCount: 100,
			fuelPoorHouseholdCount: 12,
			fuelPovertyRate: 12,
		},
		E01000002: {
			lsoaCode: "E01000002",
			lsoaName: "Another LSOA",
			householdCount: 300,
			fuelPoorHouseholdCount: 48,
			fuelPovertyRate: 16,
		},
	},
};

const aggregate: AggregatedFuelPovertyData = {
	householdCount: 1_000,
	fuelPoorHouseholdCount: 102,
	fuelPovertyRate: 10.2,
};

const ladStats = aggregateFuelPovertyByLad(dataset.data, {
	E01000001: "E09000001",
	E01000002: "E09000001",
});

const localAuthorityAggregate: AggregatedFuelPovertyData = {
	householdCount: 400,
	fuelPoorHouseholdCount: 60,
	fuelPovertyRate: 15,
};

describe("resolveFuelPovertyStats", () => {
	it("shows the selected location aggregate when no feature is hovered", () => {
		expect(
			resolveFuelPovertyStats(
				dataset,
				{ 2024: aggregate },
				null,
				ladStats,
			),
		).toEqual(aggregate);
	});

	it("shows the published value for a hovered LSOA", () => {
		expect(
			resolveFuelPovertyStats(
				dataset,
				{ 2024: aggregate },
				{
					type: "lsoa",
					code: "E01000001",
					name: "Example LSOA",
					data: null,
				},
				ladStats,
			),
		).toEqual(dataset.data.E01000001);
	});

	it("shows a household-weighted local-authority summary for a ward", () => {
		expect(
			resolveFuelPovertyStats(
				dataset,
				{ 2024: aggregate },
				{
					type: "ward",
					code: "E05000001",
					name: "Example ward",
					data: {
						ladCode: "E09000001",
						ladName: "Example local authority",
						wardCode: "E05000001",
						wardName: "Example ward",
						totalVotes: 0,
						turnoutPercent: 0,
						electorate: 0,
						partyVotes: {},
					},
				},
				ladStats,
			),
		).toEqual(localAuthorityAggregate);
	});

	it("does not use the selected-location aggregate when a ward has no LAD summary", () => {
		expect(
			resolveFuelPovertyStats(
				dataset,
				{ 2024: aggregate },
				{
					type: "ward",
					code: "E05000002",
					name: "Unmapped ward",
					data: null,
				},
				ladStats,
			),
		).toBeNull();
	});

	it("resolves a ward's authority through the ward mapping", () => {
		expect(
			resolveFuelPovertyStats(
				dataset,
				{ 2024: aggregate },
				{ type: "ward", code: "E05014827", name: "Ward", data: null },
				ladStats,
				{ getLadForWard: () => "E09000001" },
			),
		).toEqual(localAuthorityAggregate);
	});
});
