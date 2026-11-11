import { type DeclaredDataset, periods } from "../declaredStatistics.ts";
import { yearParts } from "../declaredPayload.ts";
import { PREMISES, measure, per100k } from "./measures.ts";

/** Energy, emissions, air, land, waste and connectivity. */

export const AIR_QUALITY: DeclaredDataset = {
	type: "airQuality",
	module: "environment",
	payload: {
		parts: yearParts("airQuality", "localAuthority", 2024),
		code: "ladCode",
	},
	name: "ladName",
	measures: [
		measure(
			"air-quality-grid-cells",
			"Air quality grid cells",
			"grid cells",
			"count",
			"sum",
			"1 km grid cells of the background pollution maps averaged for the area.",
		),
		measure(
			"background-concentration",
			"Background concentration",
			"micrograms per cubic metre",
			"mean",
			"weighted_mean",
			"Modelled annual mean background concentration, averaged over the area's 1 km grid cells.",
			{ weight: "air-quality-grid-cells" },
		),
		measure(
			"pm25-population-weighted",
			"Population-weighted PM2.5",
			"micrograms per cubic metre",
			"mean",
			"weighted_mean",
			"Annual mean PM2.5 concentration weighted by where people live.",
		),
		measure(
			"pm25-population-weighted-anthropogenic",
			"Population-weighted anthropogenic PM2.5",
			"micrograms per cubic metre",
			"mean",
			"weighted_mean",
			"Human-made part of the annual mean PM2.5 concentration, weighted by where people live.",
		),
	],
	dimensions: [
		{
			slug: "pollutant",
			label: "Pollutant",
			members: [
				{ key: "no2", label: "Nitrogen dioxide" },
				{ key: "pm25", label: "PM2.5" },
				{ key: "pm10", label: "PM10" },
			],
		},
	],
	// The compiler averages the 1 km grid over each area, so the means and
	// their cell counts are derived; the population-weighted figures are
	// published per area.
	fields: [
		...["no2", "pm25", "pm10"].map((pollutant) => ({
			path: `${pollutant}Mean`,
			measure: "background-concentration",
			members: { pollutant },
			statusOfAll: "derived" as const,
		})),
		{
			path: "gridCells",
			measure: "air-quality-grid-cells",
			statusOfAll: "derived",
		},
		{ path: "pm25PopulationWeighted", measure: "pm25-population-weighted" },
		{
			path: "pm25PopulationWeightedAnthropogenic",
			measure: "pm25-population-weighted-anthropogenic",
		},
	],
};

export const GHG_EMISSIONS: DeclaredDataset = {
	type: "ghgEmissions",
	module: "environment",
	payload: {
		parts: yearParts("ghgEmissions", "localAuthority", 2025, {
			coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
		}),
		code: "ladCode",
	},
	name: "ladName",
	measures: [
		measure(
			"ghg-emissions",
			"Greenhouse gas emissions",
			"kt co2e",
			"amount",
			"sum",
			"Territorial greenhouse gas emissions in kilotonnes of carbon dioxide equivalent.",
		),
		measure(
			"ghg-population",
			"Population",
			"thousand people",
			"count",
			"sum",
			"The mid-year population the publisher divides emissions by, in thousands.",
		),
	],
	dimensions: [
		{
			slug: "emissions-sector",
			label: "Emissions sector",
			members: [
				{ key: "totalKtCO2e", code: "total", label: "All sectors" },
				{
					key: "excludingLandUseKtCO2e",
					code: "total-excluding-land-use",
					label: "All sectors except land use, land-use change and forestry",
				},
				{ key: "transport", label: "Transport", parent: "totalKtCO2e" },
				{ key: "domestic", label: "Domestic", parent: "totalKtCO2e" },
				{ key: "industry", label: "Industry", parent: "totalKtCO2e" },
				{
					key: "commercial",
					label: "Commercial",
					parent: "totalKtCO2e",
				},
				{
					key: "publicSector",
					code: "public-sector",
					label: "Public sector",
					parent: "totalKtCO2e",
				},
				{
					key: "agriculture",
					label: "Agriculture",
					parent: "totalKtCO2e",
				},
				{ key: "waste", label: "Waste", parent: "totalKtCO2e" },
				{
					key: "landUse",
					code: "land-use",
					label: "Land use, land-use change and forestry",
					parent: "totalKtCO2e",
				},
			],
		},
	],
	fields: [
		{ path: "{emissions-sector}", measure: "ghg-emissions" },
		{ path: "populationThousands", measure: "ghg-population" },
	],
	derived: {
		perPersonTCO2e:
			"Total emissions divided by the publisher's population.",
	},
	computed: {
		// kt over thousands of people is tonnes per person.
		perPersonTCO2e: (record) => {
			const population = record.populationThousands as number;
			return population > 0
				? (record.totalKtCO2e as number) / population
				: 0;
		},
	},
};

const METER_TYPE = {
	slug: "meter-type",
	label: "Meter type",
	members: [
		{ key: "allMetersGwh", code: "all", label: "All meters" },
		{
			key: "domesticGwh",
			code: "domestic",
			label: "Domestic",
			parent: "allMetersGwh",
		},
		{
			key: "nonDomesticGwh",
			code: "non-domestic",
			label: "Non-domestic",
			parent: "allMetersGwh",
		},
	],
};

const consumption = (type: string, fuel: "electricity" | "gas") => ({
	type,
	module: "environment" as const,
	payload: {
		parts: yearParts(type, "localAuthority", 2025, {
			coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT"],
		}),
		code: "ladCode",
	},
	name: "ladName",
	measures: [
		measure(
			`${fuel}-consumption`,
			`${fuel === "gas" ? "Gas" : "Electricity"} consumption`,
			"gwh",
			"amount",
			"sum",
			`Metered ${fuel} consumption in gigawatt hours.`,
		),
		measure(
			`${fuel}-meters`,
			`${fuel === "gas" ? "Gas" : "Electricity"} meters`,
			"thousand meters",
			"count",
			"sum",
			`${fuel === "gas" ? "Gas" : "Electricity"} meters, in thousands.`,
		),
	],
	dimensions: [METER_TYPE],
	fields: [
		{ path: "{meter-type}", measure: `${fuel}-consumption` },
		{ path: "metersThousands", measure: `${fuel}-meters` },
	],
	...per100k((record) => record.allMetersGwh),
});
export const ELECTRICITY_CONSUMPTION: DeclaredDataset = consumption(
	"electricityConsumption",
	"electricity",
);
export const GAS_CONSUMPTION: DeclaredDataset = consumption(
	"gasConsumption",
	"gas",
);

export const WASTE: DeclaredDataset = {
	type: "waste",
	module: "environment",
	payload: {
		parts: yearParts(
			"waste",
			"localAuthority",
			2025,
			{
				coverageCountries: ["GB-ENG"],
			},
			["2025"],
		),
		code: "code",
	},
	name: "name",
	period: () => periods.financialYear(2024),
	measures: [
		measure(
			"collected-waste",
			"Local authority collected waste",
			"tonnes",
			"amount",
			"sum",
			"Waste collected by the local authority, collection authorities only.",
		),
		measure(
			"household-waste-recycled",
			"Household waste sent for recycling",
			"tonnes",
			"amount",
			"sum",
			"Household waste sent for reuse, recycling or composting.",
		),
	],
	fields: [
		{ path: "value", measure: "collected-waste" },
		{ path: "metrics.recycledTonnes", measure: "household-waste-recycled" },
	],
	...per100k((record) => record.value, 2024),
};
