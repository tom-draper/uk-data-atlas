import { describe, expect, it } from "vitest";
import { airQualityStatisticsParts } from "@uk-data-atlas/datasets";

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

describe("airQualityStatisticsParts", () => {
	it("joins the grid area means to Defra's population-weighted PM2.5", async () => {
		const parts = await airQualityStatisticsParts(
			reader(populationWeighted),
		);

		expect(parts.map((part) => part.key)).toEqual(["2024"]);
		const highland = parts[0].records.find(
			(record) => record.code === "S12000017",
		)!;
		expect(highland.name).toBe("Highland");
		expect(highland.values).toEqual([
			{
				measure: "background-concentration",
				members: { pollutant: "no2" },
				value: 0.76,
				status: "derived",
			},
			{
				measure: "background-concentration",
				members: { pollutant: "pm25" },
				value: 3.36,
				status: "derived",
			},
			{
				measure: "background-concentration",
				members: { pollutant: "pm10" },
				value: 5.18,
				status: "derived",
			},
			{
				measure: "air-quality-grid-cells",
				value: 26154,
				status: "derived",
			},
			{ measure: "pm25-population-weighted", value: 3.8446 },
			{
				measure: "pm25-population-weighted-anthropogenic",
				value: 3.4446,
			},
		]);
	});

	it("refuses tables that do not name the same authorities", async () => {
		await expect(
			airQualityStatisticsParts(
				reader(`${populationWeighted}W06000015,5.9,0.4,5.5,Cardiff\n`),
			),
		).rejects.toThrow(/no row for W06000015/);
	});
});
