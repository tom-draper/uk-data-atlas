import { describe, expect, it } from "vitest";
import { loadAirQuality } from "@/lib/data/air-quality/loader";

const areaMeans = `ladCode,ladName,gridCells,no2Mean,pm10Mean,pm25Mean
E09000001,"City of London",3,33.22,17.96,11.00
S12000017,"Highland",26154,0.76,5.18,3.36
`;

const populationWeighted = `population-weighted annual mean PM2.5 concentration for 2024 (ugm-3),,,,
The total PM2.5 concentration should be used for health burden calculations,,,,
LA code,PM2.5 2024 (total),PM2.5 2024 (non-anthropogenic),PM2.5 2024 (anthropogenic),Local Authority
E09000001,10.9,0.5,10.4,City of London
S12000017,3.8446,0.4,3.4446,Highland
`;

const reader = (weighted: string) => async (path: string) =>
	path.endsWith("popwmpm252024byUKlocalauthority.csv") ? weighted : areaMeans;

describe("loadAirQuality", () => {
	it("joins the grid area means to Defra's population-weighted PM2.5", async () => {
		const datasets = await loadAirQuality(reader(populationWeighted));

		expect(datasets[2024]).toMatchObject({
			id: "airQuality2024",
			boundaryYear: 2024,
		});
		expect(datasets[2024].data.S12000017).toEqual({
			ladCode: "S12000017",
			ladName: "Highland",
			no2Mean: 0.76,
			pm10Mean: 5.18,
			pm25Mean: 3.36,
			gridCells: 26154,
			pm25PopulationWeighted: 3.8446,
			pm25PopulationWeightedAnthropogenic: 3.4446,
		});
	});

	it("refuses tables that do not name the same authorities", async () => {
		await expect(
			loadAirQuality(
				reader(`${populationWeighted}W06000015,5.9,0.4,5.5,Cardiff\n`),
			),
		).rejects.toThrow(/no row for W06000015/);
	});
});
