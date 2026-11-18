import type { ElectricityConsumptionDataset } from "../../../types/energyConsumption.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import {
	energyDisplay,
	energyStatistics,
} from "../../../data/energy-consumption/declaration.ts";
import { ELECTRICITY_CONSUMPTION_SOURCE as SOURCE } from "../../../data/energy-consumption/source.ts";

export const electricityConsumption =
	defineDataset<ElectricityConsumptionDataset>({
		id: "electricity-consumption",
		topic: "energy",
		boundary: { type: "localAuthority", year: 2025 },
		coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
		guide: {
			title: "Subnational electricity consumption",
			about: "How much electricity homes and businesses in each local authority in Great Britain use each year, from meter readings.",
			summary:
				"Metered electricity used in each Great Britain local authority from 2015 to 2024, split between domestic and non-domestic meters. These are meter readings rather than a model, so they add up over areas exactly. The map legend switches between all, domestic and non-domestic meters, in total GWh or GWh per 100,000 residents. Cards show the selected meter group in total GWh; regional figures sum consumption.",
		},
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
		load: noCompiledPayload<ElectricityConsumptionDataset>(),
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
