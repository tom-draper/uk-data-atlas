import { describe, expect, it } from "vitest";
import {
	aggregateGhgEmissions,
	ghgEmissionsStatisticsParts,
} from "@uk-data-atlas/datasets";
import type { GhgEmissionsLADData } from "@uk-data-atlas/datasets";

const csv = `ladCode,ladName,year,populationThousands,areaKm2,transport,domestic,industry,commercial,publicSector,agriculture,waste,lulucf
E06000001,Hartlepool,2023,90.000,98.3466,200.000,100.000,50.000,25.000,10.000,5.000,10.000,-10.000
E06000001,Hartlepool,2024,100.000,98.3466,210.000,110.000,55.000,25.000,10.000,5.000,10.000,-25.000
E06000002,Middlesbrough,2024,150.000,53.8961,300.000,150.000,40.000,30.000,20.000,5.000,5.000,0.000
`;

const read = async () => csv;

const sector = (
	record: {
		values: {
			measure: string;
			members?: Record<string, string>;
			value: number | null;
		}[];
	},
	key: string,
) =>
	record.values.find(
		(value) =>
			value.measure === "ghg-emissions" &&
			value.members?.["emissions-sector"] === key,
	)?.value;

describe("ghgEmissionsStatisticsParts", () => {
	it("totals every sector and keeps the population it is divided by", async () => {
		const parts = await ghgEmissionsStatisticsParts(read);
		const hartlepool = parts
			.find((part) => part.key === "2024")!
			.records.find((record) => record.code === "E06000001")!;

		// 210 + 110 + 55 + 25 + 10 + 5 + 10 - 25
		expect(sector(hartlepool, "totalKtCO2e")).toBeCloseTo(400);
		expect(sector(hartlepool, "excludingLandUseKtCO2e")).toBeCloseTo(425);
		expect(sector(hartlepool, "landUse")).toBeCloseTo(-25);
		expect(
			hartlepool.values.find(
				(value) => value.measure === "ghg-population",
			)?.value,
		).toBe(100);
	});

	it("emits one part per year, in order", async () => {
		const parts = await ghgEmissionsStatisticsParts(read);

		expect(parts.map((part) => part.key)).toEqual(["2023", "2024"]);
		expect(parts[0].records.map((record) => record.code)).toEqual([
			"E06000001",
		]);
		expect(parts[1].records[0].name).toBe("Hartlepool");
	});
});

const record = (
	overrides: Partial<GhgEmissionsLADData>,
): GhgEmissionsLADData => ({
	ladCode: "E06000001",
	ladName: "Hartlepool",
	totalKtCO2e: 0,
	excludingLandUseKtCO2e: 0,
	perPersonTCO2e: 0,
	populationThousands: 0,
	transport: 0,
	domestic: 0,
	industry: 0,
	commercial: 0,
	publicSector: 0,
	agriculture: 0,
	waste: 0,
	landUse: 0,
	...overrides,
});

describe("aggregateGhgEmissions", () => {
	it("recomputes the per-person figure from the summed population", () => {
		const aggregated = aggregateGhgEmissions([
			record({
				totalKtCO2e: 400,
				perPersonTCO2e: 4,
				populationThousands: 100,
				transport: 210,
			}),
			record({
				ladCode: "E06000002",
				totalKtCO2e: 550,
				perPersonTCO2e: 550 / 150,
				populationThousands: 150,
				transport: 300,
			}),
		]);

		// 400 + 550 kt over 250 thousand residents, not the mean of 4 and 3.67.
		expect(aggregated?.totalKtCO2e).toBeCloseTo(950);
		expect(aggregated?.perPersonTCO2e).toBeCloseTo(3.8);
		expect(aggregated?.transport).toBeCloseTo(510);
	});

	it("reports nothing for an area with no authorities", () => {
		expect(aggregateGhgEmissions([])).toBeNull();
	});
});
