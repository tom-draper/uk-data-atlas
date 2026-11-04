import { loadElectricityConsumption } from "../../energy-consumption/loader.ts";
import { ELECTRICITY_CONSUMPTION_SOURCE } from "../../energy-consumption/source.ts";
import type { ElectricityConsumptionDataset } from "../../../types/energyConsumption.ts";
import type { DatasetDefinition } from "../types.ts";
import { loadPopulationUk } from "../../population/ukLoader.ts";
import { addPopulationMetrics } from "../../population/metrics.ts";

export const electricityConsumptionDatasetDefinition: DatasetDefinition<ElectricityConsumptionDataset> =
	{
		type: "electricityConsumption",
		precompiledFile: "electricity-consumption",
		boundaryType: "localAuthority",
		coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
		source: ELECTRICITY_CONSUMPTION_SOURCE,
		ingestion: {
			minimumDatasets: 10,
			minimumDataRecords: 350,
			expectedBoundaryYears: [2025],
			requiredDataFields: ["allMetersGwh", "domesticGwh"],
		},
		precompile: async ({ text, xlsxSheet }) => {
			const datasets = await loadElectricityConsumption(text);
			const population = await loadPopulationUk(xlsxSheet);
			for (const dataset of Object.values(datasets)) {
				addPopulationMetrics(
					dataset.data,
					population[dataset.year]?.data ?? {},
					(record) => record.allMetersGwh,
				);
			}
			return datasets;
		},
	};
