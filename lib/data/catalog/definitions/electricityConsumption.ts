import { loadElectricityConsumption } from "../../energy-consumption/loader";
import { ELECTRICITY_CONSUMPTION_SOURCE } from "../../energy-consumption/source";
import type { ElectricityConsumptionDataset } from "@/lib/types/energyConsumption";
import type { DatasetDefinition } from "../types";
import { loadPopulationUk } from "../../population/ukLoader";
import { addPopulationMetrics } from "../../population/metrics";

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
