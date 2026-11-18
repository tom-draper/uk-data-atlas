import type { GasConsumptionDataset } from "../../../types/energyConsumption.ts";
import {
	defineDataset,
	noCompiledPayload,
} from "../../../declaration/dataset.ts";
import {
	energyDisplay,
	energyStatistics,
} from "../../../data/energy-consumption/declaration.ts";
import { GAS_CONSUMPTION_SOURCE as SOURCE } from "../../../data/energy-consumption/source.ts";

export const gasConsumption = defineDataset<GasConsumptionDataset>({
	id: "gas-consumption",
	topic: "energy",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
	guide: {
		title: "Subnational gas consumption",
		about: "How much mains gas homes and businesses in each local authority in Great Britain use each year, from meter readings, adjusted for the weather.",
		summary:
			"Metered gas used in each Great Britain local authority from 2015 to 2024, split between domestic and non-domestic meters. These are meter readings rather than a model, so they add up over areas exactly. The map legend switches between all, domestic and non-domestic meters, in total GWh or GWh per 100,000 residents. Cards show the selected meter group in total GWh; regional figures sum consumption.",
	},
	sources: [
		{
			name: "energy-consumption",
			exception:
				"One download feeds both datasets, and neither id names it.",
		},
	],
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
	load: noCompiledPayload<GasConsumptionDataset>(),
	statistics: energyStatistics("gas", "gas-consumption"),
	display: energyDisplay({
		fuel: "gas",
		label: "Gas Consumption [2024]",
		year: 2024,
		source: "Department for Energy Security and Net Zero. Subnational gas consumption. gov.uk",
		totalRange: 5000,
		rateRange: 2500,
		legendMax: 8000,
	}),
});
