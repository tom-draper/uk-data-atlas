import { describe, expect, it } from "vitest";
import { loadGhgEmissions } from "@/lib/data/ghg-emissions/loader";
import { aggregateGhgEmissions } from "@/lib/helpers/datasetAggregation/numeric";

const csv = `ladCode,ladName,year,populationThousands,areaKm2,transport,domestic,industry,commercial,publicSector,agriculture,waste,lulucf
E06000001,Hartlepool,2023,90.000,98.3466,200.000,100.000,50.000,25.000,10.000,5.000,10.000,-10.000
E06000001,Hartlepool,2024,100.000,98.3466,210.000,110.000,55.000,25.000,10.000,5.000,10.000,-25.000
E06000002,Middlesbrough,2024,150.000,53.8961,300.000,150.000,40.000,30.000,20.000,5.000,5.000,0.000
`;

const read = async () => csv;

describe("loadGhgEmissions", () => {
	it("totals every sector and derives emissions per resident", async () => {
		const datasets = await loadGhgEmissions(read);
		const hartlepool = datasets[2024].data.E06000001;

		// 210 + 110 + 55 + 25 + 10 + 5 + 10 - 25
		expect(hartlepool.totalKtCO2e).toBeCloseTo(400);
		expect(hartlepool.excludingLandUseKtCO2e).toBeCloseTo(425);
		// kt over thousands of people is tonnes per person.
		expect(hartlepool.perPersonTCO2e).toBeCloseTo(4);
		expect(hartlepool.landUse).toBeCloseTo(-25);
	});

	it("emits one dataset per year on a single code vintage", async () => {
		const datasets = await loadGhgEmissions(read);

		expect(Object.keys(datasets)).toEqual(["2023", "2024"]);
		expect(datasets[2024]).toMatchObject({
			id: "ghgEmissions2024",
			type: "ghgEmissions",
			boundaryType: "localAuthority",
			boundaryYear: 2025,
		});
		expect(Object.keys(datasets[2023].data)).toEqual(["E06000001"]);
	});
});

describe("aggregateGhgEmissions", () => {
	it("recomputes the per-person figure from the summed population", async () => {
		const datasets = await loadGhgEmissions(read);
		const records = Object.values(datasets[2024].data);
		const aggregated = aggregateGhgEmissions(records);

		// 400 + 550 kt over 250 thousand residents, not the mean of 4 and 3.67.
		expect(aggregated?.totalKtCO2e).toBeCloseTo(950);
		expect(aggregated?.perPersonTCO2e).toBeCloseTo(3.8);
		expect(aggregated?.transport).toBeCloseTo(510);
	});

	it("reports nothing for an area with no authorities", () => {
		expect(aggregateGhgEmissions([])).toBeNull();
	});
});
