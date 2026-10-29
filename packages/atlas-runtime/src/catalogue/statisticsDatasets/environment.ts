import { type DeclaredDataset, periods } from "../declaredStatistics";
import { PREMISES, measure, per100k } from "./measures";

/** Energy, emissions, air, land, waste and connectivity. */

export const AIR_QUALITY: DeclaredDataset = {
	type: "airQuality",
	name: "ladName",
	rebuild: {},
	measures: [
		measure(
			"background-concentration",
			"Background concentration",
			"micrograms per cubic metre",
			"mean",
			"weighted_mean",
			"Modelled annual mean background concentration, averaged over the area's 1 km grid cells.",
		),
		measure(
			"air-quality-grid-cells",
			"Air quality grid cells",
			"grid cells",
			"count",
			"sum",
			"1 km grid cells of the background pollution maps averaged for the area.",
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
	fields: [
		...["no2", "pm25", "pm10"].map((pollutant) => ({
			path: `${pollutant}Mean`,
			measure: "background-concentration",
			members: { pollutant },
		})),
		{ path: "gridCells", measure: "air-quality-grid-cells" },
		{ path: "pm25PopulationWeighted", measure: "pm25-population-weighted" },
		{
			path: "pm25PopulationWeightedAnthropogenic",
			measure: "pm25-population-weighted-anthropogenic",
		},
	],
};

export const GHG_EMISSIONS: DeclaredDataset = {
	type: "ghgEmissions",
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
	rebuild: {
		derived: {
			// kt over thousands of people is tonnes per person.
			perPersonTCO2e: (record) => {
				const population = record.populationThousands as number;
				return population > 0
					? (record.totalKtCO2e as number) / population
					: 0;
			},
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

export const ELECTRIC_VEHICLE_CHARGERS: DeclaredDataset = {
	type: "electricVehicleChargers",
	name: "name",
	period: () => periods.date("2026-07-01"),
	measures: [
		measure(
			"public-ev-chargers",
			"Public electric vehicle chargers",
			"chargers",
			"count",
			"sum",
			"Publicly available electric vehicle charging devices.",
		),
	],
	fields: [{ path: "value", measure: "public-ev-chargers" }],
	...per100k((record) => record.value, 2024),
};

export const WASTE: DeclaredDataset = {
	type: "waste",
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

export const LAND_AREA: DeclaredDataset = {
	type: "landArea",
	name: "ladName",
	measures: [
		measure(
			"area",
			"Area",
			"hectares",
			"amount",
			"sum",
			"Area of the boundary, in hectares.",
		),
	],
	dimensions: [
		{
			slug: "surface",
			label: "Surface",
			members: [
				{
					key: "extentHectares",
					code: "extent",
					label: "Extent to mean high water",
				},
				{
					key: "landHectares",
					code: "land",
					label: "Land",
					parent: "extentHectares",
				},
				{
					key: "inlandWaterHectares",
					code: "inland-water",
					label: "Inland water",
					parent: "extentHectares",
				},
			],
		},
	],
	fields: [{ path: "{surface}", measure: "area" }],
	derived: { landSquareKm: "Land hectares in square kilometres." },
	rebuild: {
		derived: {
			landSquareKm: (record) => (record.landHectares as number) / 100,
		},
	},
};

export const BROADBAND: DeclaredDataset = {
	type: "broadband",
	rebuild: {},
	name: "ladName",
	period: () => periods.month(2025, 7),
	measures: [
		measure(
			"broadband-availability",
			"Broadband availability",
			"percent of premises",
			"share",
			"weighted_mean",
			"Premises that can get fixed broadband at the speed, as a percentage of premises.",
		),
		PREMISES,
	],
	dimensions: [
		{
			slug: "broadband-speed",
			label: "Broadband speed",
			members: [
				{
					key: "pctSuperfast",
					code: "superfast",
					label: "Superfast (30 Mbit/s or more)",
				},
				{
					key: "pctUltrafast",
					code: "ultrafast",
					label: "Ultrafast (300 Mbit/s or more)",
				},
				{
					key: "pctFullFibre",
					code: "full-fibre",
					label: "Full fibre",
				},
				{
					key: "pctGigabit",
					code: "gigabit",
					label: "Gigabit capable",
				},
			],
		},
	],
	fields: [
		{ path: "{broadband-speed}", measure: "broadband-availability" },
		{ path: "premisesCount", measure: "premises" },
	],
};

export const MOBILE_COVERAGE: DeclaredDataset = {
	type: "mobileCoverage",
	rebuild: {},
	name: "ladName",
	measures: [
		measure(
			"mobile-premises-coverage",
			"Mobile coverage of premises",
			"percent of premises",
			"share",
			"weighted_mean",
			"Premises with mobile coverage, as a percentage of premises.",
		),
		measure(
			"mobile-area-coverage",
			"Mobile coverage of land",
			"percent of area",
			"share",
			"weighted_mean",
			"Land area with outdoor mobile coverage, as a percentage of the area.",
		),
		PREMISES,
	],
	dimensions: [
		{
			slug: "mobile-technology",
			label: "Mobile technology",
			members: [
				{ key: "4g", label: "4G" },
				{ key: "5g", label: "5G" },
			],
		},
		{
			slug: "coverage-location",
			label: "Coverage location",
			members: [
				{ key: "indoor", label: "Indoors" },
				{ key: "outdoor", label: "Outdoors" },
			],
		},
		{
			slug: "mobile-operators",
			label: "Mobile operators",
			members: [
				{ key: "all", label: "All four operators" },
				{ key: "any", label: "At least one operator" },
			],
		},
	],
	fields: [
		...[
			[
				"pct4GIndoorAll",
				"mobile-premises-coverage",
				"4g",
				"indoor",
				"all",
			],
			[
				"pct4GIndoorAny",
				"mobile-premises-coverage",
				"4g",
				"indoor",
				"any",
			],
			[
				"pct5GOutdoorAll",
				"mobile-premises-coverage",
				"5g",
				"outdoor",
				"all",
			],
			[
				"pct5GOutdoorAny",
				"mobile-premises-coverage",
				"5g",
				"outdoor",
				"any",
			],
			["pct4GGeoAll", "mobile-area-coverage", "4g", "outdoor", "all"],
			["pct5GGeoAny", "mobile-area-coverage", "5g", "outdoor", "any"],
		].map(([path, measure, technology, location, operators]) => ({
			path,
			measure,
			members: {
				"mobile-technology": technology,
				"coverage-location": location,
				"mobile-operators": operators,
			},
		})),
		{ path: "premisesCount", measure: "premises" },
	],
};
