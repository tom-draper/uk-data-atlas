import { loadElectricityConsumption } from "../../energy-consumption/loader";
import { ELECTRICITY_CONSUMPTION_SOURCE } from "../../energy-consumption/source";
import type { ElectricityConsumptionDataset } from "@/lib/types/energyConsumption";
import type { DatasetDefinition } from "../types";

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
		// No chart yet: the API serves the series without one.
		chartPending: true,
		precompile: ({ text }) => loadElectricityConsumption(text),
	};
