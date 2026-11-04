import { loadGasConsumption } from "../../energy-consumption/loader.ts";
import { GAS_CONSUMPTION_SOURCE } from "../../energy-consumption/source.ts";
import type { GasConsumptionDataset } from "../../../types/energyConsumption.ts";
import type { DatasetDefinition } from "../types.ts";
import { loadPopulationUk } from "../../population/ukLoader.ts";
import { addPopulationMetrics } from "../../population/metrics.ts";

export const gasConsumptionDatasetDefinition: DatasetDefinition<GasConsumptionDataset> =
	{
		type: "gasConsumption",
		precompiledFile: "gas-consumption",
		boundaryType: "localAuthority",
		coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
		source: GAS_CONSUMPTION_SOURCE,
		ingestion: {
			minimumDatasets: 10,
			minimumDataRecords: 347,
			expectedBoundaryYears: [2025],
			requiredDataFields: ["allMetersGwh", "domesticGwh"],
		},
		precompile: async ({ text, xlsxSheet }) => {
			const datasets = await loadGasConsumption(text);
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
