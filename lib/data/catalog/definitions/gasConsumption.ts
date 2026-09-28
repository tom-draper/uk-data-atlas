import { loadGasConsumption } from "../../energy-consumption/loader";
import { GAS_CONSUMPTION_SOURCE } from "../../energy-consumption/source";
import type { GasConsumptionDataset } from "@/lib/types/energyConsumption";
import type { DatasetDefinition } from "../types";

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
		chartPending: true,
		precompile: ({ text }) => loadGasConsumption(text),
	};
