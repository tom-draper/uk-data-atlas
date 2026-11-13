import type { ElectricityConsumptionDataset } from "../../../types/energyConsumption.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import {
	energyDisplay,
	energyStatistics,
	loadWithPopulation,
} from "../../../data/energy-consumption/declaration.ts";
import { loadElectricityConsumption } from "../../../data/energy-consumption/loader.ts";
import { ELECTRICITY_CONSUMPTION_SOURCE as SOURCE } from "../../../data/energy-consumption/source.ts";

export const electricityConsumption =
	defineDataset<ElectricityConsumptionDataset>({
		id: "electricity-consumption",
		topic: "energy",
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
			minimumDataRecords: 350,
			expectedBoundaryYears: [2025],
			requiredDataFields: ["allMetersGwh", "domesticGwh"],
		},
		load: loadWithPopulation(loadElectricityConsumption),
		statistics: energyStatistics("electricity", "electricity-consumption"),
		display: energyDisplay({
			fuel: "electricity",
			label: "Electricity Consumption [2024]",
			year: 2024,
			source: "Department for Energy Security and Net Zero. Subnational electricity consumption. gov.uk",
			totalRange: 2500,
			rateRange: 1500,
			legendMax: 4000,
		}),
	});
