import type { GhgEmissionsDataset } from "../../../types/ghgEmissions.ts";
import { defineDataset } from "../../../declaration/dataset.ts";
import { measure } from "../../../declaration/measures.ts";
import { yearParts } from "../../../declaration/yearParts.ts";
import { aggregateGhgEmissions } from "../../../data/ghg-emissions/aggregate.ts";
import { ghgEmissionsStatisticsParts } from "../../../data/ghg-emissions/source.ts";

export const ghgEmissions = defineDataset<GhgEmissionsDataset>({
	id: "ghg-emissions",
	topic: "emissions",
	boundary: { type: "localAuthority", year: 2025 },
	coverageCountries: ["GB-ENG", "GB-WLS", "GB-SCT", "GB-NIR"],
	guide: {
		title: "Greenhouse Gas Emissions",
		about: "Estimated greenhouse gas emissions produced within each local authority. The map defaults to emissions per person so areas of different sizes can be compared. Select total emissions, emissions excluding land use or a sector such as transport, homes, industry or agriculture in the legend. Sector figures are totals in kilotonnes of carbon dioxide equivalent; land use can be negative where it removes more emissions than it produces.",
		summary:
			"Net greenhouse gas emissions produced within each UK local authority every year from 2005 to 2024, in kilotonnes of CO2 equivalent. The legend also maps transport, domestic, industrial, commercial, public-sector, agricultural, waste and land-use emissions separately in kt CO2e. Land use can be negative where removals exceed emissions; regional sector totals sum the authorities.",
	},
	mapName: "Greenhouse Gas Emissions",
	source: {
		name: "Greenhouse Gas Emissions",
		publisher: "Department for Energy Security and Net Zero",
		sourceUrl:
			"https://www.gov.uk/government/statistics/uk-local-authority-and-regional-greenhouse-gas-emissions-statistics-2005-to-2024",
		year: "2005-2024",
		licence: "Open Government Licence v3.0",
		licenceUrl:
			"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		attribution:
			"Department for Energy Security and Net Zero. Contains public sector information licensed under the Open Government Licence v3.0.",
		description:
			"Territorial greenhouse gas emissions by local authority across the United Kingdom, 2005 to 2024, broken down by sector. Aggregated from the published sub-sector and gas detail to a sector total in kt CO2e.",
		cadence: "annual",
		notes: [
			"Values are net territorial emissions across every sector and gas. Land use, land use change and forestry is a net sink in most rural authorities, so their totals are lower than their gross emissions. No published authority-year is negative, but nothing in the method prevents it.",
			"Emissions per resident are not served. They are a ratio, and a ratio cannot be summed over areas or compared between authorities of different size without recomputing it from the underlying totals.",
			"Local authority totals exclude sources the publisher cannot attribute to an area, such as aviation and shipping, so they do not sum to the national inventory.",
		],
	},
	ingestion: {
		minimumDatasets: 20,
		minimumDataRecords: 361,
		expectedBoundaryYears: [2025],
		requiredDataFields: ["totalKtCO2e", "perPersonTCO2e"],
	},
	placeHeadline: {
		places: ["localAuthority"],
		order: 110,
		label: "Emissions",
		about: "Greenhouse gases per resident, in CO2e",
	},
	placeTrends: [
		{
			key: "emissions-per-person",
			places: ["localAuthority"],
			order: 60,
			label: "Greenhouse gas emissions per person",
			measure: "ghg-emissions",
			dimensions: { "emissions-sector": "total" },
			per: { measure: "ghg-population", dimensions: {} },
			format: { kind: "decimal", digits: 1, suffix: " tonnes" },
		},
	],
	statistics: {
		direct: {
			only: true,
			read: ({ text }) => ghgEmissionsStatisticsParts(text),
		},
		payload: {
			parts: yearParts("ghg-emissions", "localAuthority", 2025, {
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
				"total",
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
					{
						key: "transport",
						label: "Transport",
						parent: "totalKtCO2e",
					},
					{
						key: "domestic",
						label: "Domestic",
						parent: "totalKtCO2e",
					},
					{
						key: "industry",
						label: "Industry",
						parent: "totalKtCO2e",
					},
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
	},
	ranking: {
		label: "Emissions per person (CO2e)",
		format: { kind: "decimal", digits: 1, suffix: " tonnes" },
	},
	catalogue: {
		kind: "indicators",
		yearly: true,
		checks: ["manifest-records", "manifest-periods"],
		coverageNote:
			"Published source records cover all four UK nations for every available period, restated on one code vintage by the publisher.",
		indicators: [
			{
				id: "ghg-emissions",
				label: "Greenhouse gas emissions",
				field: "totalKtCO2e",
				valueKind: "quantity",
				unit: "kt CO2e",
				aggregation: "sum",
				notes: [],
				measure: "ghg-emissions",
				members: { "emissions-sector": "total" },
			},
		],
	},
	display: {
		label: "Greenhouse Gas Emissions [2024]",
		year: 2024,
		card: {
			heading: "Greenhouse Gas Emissions",
			source: "DESNZ. UK local authority greenhouse gas emissions. gov.uk",
			pills: [
				{
					label: "Transport",
					field: "transport",
					unit: "kt",
					digits: 0,
				},
				{ label: "Domestic", field: "domestic", unit: "kt", digits: 0 },
				{ label: "Industry", field: "industry", unit: "kt", digits: 0 },
			],
			appearance: { layout: "pills", accent: "#0ea5e9" },
		},
		measures: [
			{
				id: "perPerson",
				card: {
					unit: "t CO₂e per person",
					digits: 1,
					maximum: 12,
					secondary: {
						field: "totalKtCO2e",
						format: {
							kind: "count",
							round: true,
							suffix: " kt total",
						},
					},
				},
				label: "Net emissions per person",
				field: "perPersonTCO2e",
				colorRange: { min: 3, max: 12 },
				legend: {
					min: 0,
					max: 20,
					format: {
						kind: "decimal",
						digits: 1,
						suffix: " t CO₂e per person",
					},
				},
			},
			{
				id: "total",
				card: {
					unit: "kt CO₂e",
					format: { kind: "count", round: true },
					maximum: 2500,
					secondary: {
						field: "perPersonTCO2e",
						format: {
							kind: "decimal",
							digits: 1,
							suffix: " t per person",
						},
					},
				},
				label: "Net emissions total",
				field: "totalKtCO2e",
				colorRange: { min: 0, max: 2500 },
				legend: {
					min: 0,
					max: 6000,
					format: { kind: "decimal", digits: 0, suffix: " kt CO₂e" },
				},
			},
			{
				id: "excludingLandUse",
				card: {
					unit: "kt CO₂e",
					format: { kind: "count", round: true },
					maximum: 2500,
					secondary: {
						field: "perPersonTCO2e",
						format: {
							kind: "decimal",
							digits: 1,
							suffix: " t per person",
						},
					},
				},
				label: "Emissions excluding land use",
				field: "excludingLandUseKtCO2e",
				colorRange: { min: 0, max: 2500 },
				legend: {
					min: 0,
					max: 6000,
					format: { kind: "decimal", digits: 0, suffix: " kt CO₂e" },
				},
			},
			{
				id: "transport",
				card: {
					unit: "kt CO₂e",
					format: { kind: "count", round: true },
					maximum: 2500,
					secondary: {
						field: "perPersonTCO2e",
						format: {
							kind: "decimal",
							digits: 1,
							suffix: " t per person",
						},
					},
				},
				label: "Transport",
				field: "transport",
				colorRange: { min: 0, max: 2500 },
				legend: {
					min: 0,
					max: 6000,
					format: { kind: "decimal", digits: 0, suffix: " kt CO₂e" },
				},
			},
			{
				id: "domestic",
				card: {
					unit: "kt CO₂e",
					format: { kind: "count", round: true },
					maximum: 2500,
					secondary: {
						field: "perPersonTCO2e",
						format: {
							kind: "decimal",
							digits: 1,
							suffix: " t per person",
						},
					},
				},
				label: "Domestic",
				field: "domestic",
				colorRange: { min: 0, max: 2500 },
				legend: {
					min: 0,
					max: 6000,
					format: { kind: "decimal", digits: 0, suffix: " kt CO₂e" },
				},
			},
			{
				id: "industry",
				card: {
					unit: "kt CO₂e",
					format: { kind: "count", round: true },
					maximum: 2500,
					secondary: {
						field: "perPersonTCO2e",
						format: {
							kind: "decimal",
							digits: 1,
							suffix: " t per person",
						},
					},
				},
				label: "Industry",
				field: "industry",
				colorRange: { min: 0, max: 2500 },
				legend: {
					min: 0,
					max: 6000,
					format: { kind: "decimal", digits: 0, suffix: " kt CO₂e" },
				},
			},
			{
				id: "commercial",
				card: {
					unit: "kt CO₂e",
					format: { kind: "count", round: true },
					maximum: 2500,
					secondary: {
						field: "perPersonTCO2e",
						format: {
							kind: "decimal",
							digits: 1,
							suffix: " t per person",
						},
					},
				},
				label: "Commercial",
				field: "commercial",
				colorRange: { min: 0, max: 2500 },
				legend: {
					min: 0,
					max: 6000,
					format: { kind: "decimal", digits: 0, suffix: " kt CO₂e" },
				},
			},
			{
				id: "publicSector",
				card: {
					unit: "kt CO₂e",
					format: { kind: "count", round: true },
					maximum: 2500,
					secondary: {
						field: "perPersonTCO2e",
						format: {
							kind: "decimal",
							digits: 1,
							suffix: " t per person",
						},
					},
				},
				label: "Public sector",
				field: "publicSector",
				colorRange: { min: 0, max: 2500 },
				legend: {
					min: 0,
					max: 6000,
					format: { kind: "decimal", digits: 0, suffix: " kt CO₂e" },
				},
			},
			{
				id: "agriculture",
				card: {
					unit: "kt CO₂e",
					format: { kind: "count", round: true },
					maximum: 2500,
					secondary: {
						field: "perPersonTCO2e",
						format: {
							kind: "decimal",
							digits: 1,
							suffix: " t per person",
						},
					},
				},
				label: "Agriculture",
				field: "agriculture",
				colorRange: { min: 0, max: 2500 },
				legend: {
					min: 0,
					max: 6000,
					format: { kind: "decimal", digits: 0, suffix: " kt CO₂e" },
				},
			},
			{
				id: "waste",
				card: {
					unit: "kt CO₂e",
					format: { kind: "count", round: true },
					maximum: 2500,
					secondary: {
						field: "perPersonTCO2e",
						format: {
							kind: "decimal",
							digits: 1,
							suffix: " t per person",
						},
					},
				},
				label: "Waste",
				field: "waste",
				colorRange: { min: 0, max: 2500 },
				legend: {
					min: 0,
					max: 6000,
					format: { kind: "decimal", digits: 0, suffix: " kt CO₂e" },
				},
			},
			{
				id: "landUse",
				card: {
					unit: "kt CO₂e",
					format: { kind: "count", round: true },
					maximum: 500,
					secondary: {
						field: "perPersonTCO2e",
						format: {
							kind: "decimal",
							digits: 1,
							suffix: " t per person",
						},
					},
				},
				label: "Land use and forestry",
				field: "landUse",
				colorRange: { min: -500, max: 500 },
				legend: {
					min: -2000,
					max: 6000,
					format: { kind: "decimal", digits: 0, suffix: " kt CO₂e" },
				},
			},
		],
		aggregation: {
			scope: "localAuthority",
			aggregate: aggregateGhgEmissions,
		},
	},
});
