import type { GasConsumptionDataset } from "../../types/energyConsumption.ts";
import { defineDataset } from "../../declaration/dataset.ts";
import {
	energyDisplay,
	energyStatistics,
	loadWithPopulation,
} from "../energy-consumption/declaration.ts";
import { loadGasConsumption } from "../energy-consumption/loader.ts";
import { GAS_CONSUMPTION_SOURCE as SOURCE } from "../energy-consumption/source.ts";

export const gasConsumption = defineDataset<GasConsumptionDataset>({
	id: "gas-consumption",
	module: "environment",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
	source: {
		name: SOURCE.name,
		publisher: SOURCE.source,
		sourceUrl: SOURCE.sourceUrl,
		year: SOURCE.year,
		licence: SOURCE.licence,
		licenceUrl: SOURCE.licenceUrl,
		attribution:
			"Department for Energy Security and Net Zero. Contains public sector information licensed under the Open Government Licence v3.0.",
		description: SOURCE.description,
		cadence: "annual",
		notes: [],
	},
	ingestion: {
		minimumDatasets: 10,
		minimumDataRecords: 347,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["allMetersGwh", "domesticGwh"],
	},
	load: loadWithPopulation(loadGasConsumption),
	statistics: energyStatistics("gas", "gas-consumption"),
	display: energyDisplay({
		fuel: "gas",
		group: "Environment",
		label: "Gas Consumption [2024]",
		year: 2024,
		source: "Department for Energy Security and Net Zero. Subnational gas consumption. gov.uk",
		totalRange: 5000,
		rateRange: 2500,
		legendMax: 8000,
	}),
});
