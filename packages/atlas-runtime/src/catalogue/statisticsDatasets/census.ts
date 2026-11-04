import {
	type DeclaredDataset,
	type Json,
	periods,
} from "../declaredStatistics.ts";
import { yearParts } from "../declaredPayload.ts";
import { HOUSEHOLDS, USUAL_RESIDENTS, measure } from "./measures.ts";

/** Census 2021 tables. Each breakdown column is a dimension member. */

const census2021 = () => periods.census(2021);

/**
 * The local-authority tables give 2021 districts, plus the unitaries that
 * replaced some of them in 2023, so codes are placed on whichever release
 * holds them.
 */
const districts2021 = {
	release: () => ({ geography: "localAuthority", year: 2021 }),
	alsoIn: [{ geography: "localAuthority", year: 2023 }],
};

export const CAR_AVAILABILITY: DeclaredDataset = {
	type: "carAvailability",
	module: "transport",
	payload: {
		parts: () => [
			{
				key: "2021",
				header: {
					id: "carAvailability2021",
					type: "carAvailability",
					year: 2021,
					boundaryType: "localAuthority",
					boundaryYear: 2025,
					metadata: {
						source: "Office for National Statistics. Census 2021: Car or van availability, England and Wales. TS045.",
						notes: [
							"England and Wales only. Shares are of households, not of people.",
							"The top category is open-ended, so the table gives no vehicle count.",
						],
					},
					coverageCountries: ["GB-ENG", "GB-WLS"],
				},
			},
		],
		code: "ladCode",
	},
	...districts2021,
	period: census2021,
	measures: [HOUSEHOLDS],
	dimensions: [
		{
			slug: "cars-or-vans",
			label: "Cars or vans available",
			members: [
				{ key: "total", code: "total", label: "All households" },
				{
					key: "noCar",
					code: "none",
					label: "No cars or vans",
					parent: "total",
				},
				{
					key: "oneCar",
					code: "one",
					label: "One car or van",
					parent: "total",
				},
				{
					key: "twoCars",
					code: "two",
					label: "Two cars or vans",
					parent: "total",
				},
				{
					key: "threeOrMoreCars",
					code: "three-or-more",
					label: "Three or more cars or vans",
					parent: "total",
				},
			],
		},
	],
	fields: [{ path: "breakdown.{cars-or-vans}", measure: "households" }],
};

export const QUALIFICATION: DeclaredDataset = {
	type: "qualification",
	module: "education",
	payload: {
		parts: () => [
			{
				key: "2021",
				header: {
					id: "qualifications2021",
					type: "qualification",
					year: 2021,
					boundaryType: "localAuthority",
					boundaryYear: 2025,
					metadata: {
						source: "Office for National Statistics. Census 2021: Highest Level of Qualification, England and Wales. TS067.",
						notes: [
							"England and Wales only. Covers usual residents aged 16 and over; residents under 16, whom the table records as 'Does not apply', are excluded.",
						],
					},
					coverageCountries: ["GB-ENG", "GB-WLS"],
				},
			},
		],
		code: "ladCode",
	},
	...districts2021,
	period: census2021,
	measures: [
		measure(
			"usual-residents-16-plus",
			"Usual residents aged 16 and over",
			"people",
			"count",
			"sum",
			"Usual residents aged 16 and over counted by the census.",
		),
	],
	dimensions: [
		{
			slug: "highest-qualification",
			label: "Highest level of qualification",
			members: [
				{
					key: "total",
					code: "total",
					label: "All usual residents aged 16 and over",
				},
				{
					key: "noQualifications",
					code: "none",
					label: "No qualifications",
					parent: "total",
				},
				{
					key: "level1",
					code: "level-1",
					label: "Level 1 and entry level",
					parent: "total",
				},
				{
					key: "level2",
					code: "level-2",
					label: "Level 2",
					parent: "total",
				},
				{
					key: "apprenticeship",
					code: "apprenticeship",
					label: "Apprenticeship",
					parent: "total",
				},
				{
					key: "level3",
					code: "level-3",
					label: "Level 3",
					parent: "total",
				},
				{
					key: "level4Plus",
					code: "level-4-plus",
					label: "Level 4 and above",
					parent: "total",
				},
				{
					key: "other",
					code: "other",
					label: "Other qualifications",
					parent: "total",
				},
			],
		},
	],
	fields: [
		{
			path: "breakdown.{highest-qualification}",
			measure: "usual-residents-16-plus",
		},
	],
};

export const TRAVEL_TO_WORK: DeclaredDataset = {
	type: "travelToWork",
	module: "transport",
	payload: {
		parts: () => [
			{
				key: "2021",
				header: {
					id: "travelToWork2021",
					type: "travelToWork",
					year: 2021,
					boundaryType: "localAuthority",
					boundaryYear: 2025,
					metadata: {
						source: "Office for National Statistics. Census 2021: Method used to travel to workplace, England and Wales. TS061.",
						notes: [
							"England and Wales only. Shares are of people in employment, so those not in employment or aged under 16 are excluded.",
							"Working mainly at or from home is counted as a method of travel, as the census reports it.",
						],
					},
					coverageCountries: ["GB-ENG", "GB-WLS"],
				},
			},
		],
		code: "ladCode",
	},
	...districts2021,
	period: census2021,
	measures: [
		measure(
			"people-in-employment",
			"People in employment",
			"people",
			"count",
			"sum",
			"Usual residents aged 16 and over in employment in the week before the census.",
		),
	],
	dimensions: [
		{
			slug: "travel-method",
			label: "Method of travel to work",
			members: [
				{
					key: "total",
					code: "total",
					label: "All people in employment",
				},
				{
					key: "workFromHome",
					code: "home",
					label: "Work mainly at or from home",
					parent: "total",
				},
				{
					key: "publicTransport",
					code: "public-transport",
					label: "Public transport",
					parent: "total",
				},
				{
					key: "car",
					code: "car",
					label: "Car or van",
					parent: "total",
				},
				{ key: "taxi", code: "taxi", label: "Taxi", parent: "total" },
				{
					key: "motorcycle",
					code: "motorcycle",
					label: "Motorcycle, scooter or moped",
					parent: "total",
				},
				{
					key: "bicycle",
					code: "bicycle",
					label: "Bicycle",
					parent: "total",
				},
				{
					key: "onFoot",
					code: "on-foot",
					label: "On foot",
					parent: "total",
				},
				{
					key: "other",
					code: "other",
					label: "Other method",
					parent: "total",
				},
			],
		},
	],
	fields: [
		{ path: "breakdown.{travel-method}", measure: "people-in-employment" },
	],
};

/** The census's code for each ethnic group. */
const ETHNICITY_CODES: Readonly<Record<string, string>> = Object.fromEntries(
	[
		"Bangladeshi",
		"Chinese",
		"Indian",
		"Pakistani",
		"Other Asian",
		"African",
		"Caribbean",
		"Other Black",
		"White and Asian",
		"White and Black African",
		"White and Black Caribbean",
		"Other Mixed or Multiple ethnic groups",
		"English, Welsh, Scottish, Northern Irish or British",
		"Irish",
		"Gypsy or Irish Traveller",
		"Roma",
		"Other White",
		"Arab",
		"Any other ethnic group",
	].map((name, index) => [name, String(index + 1)]),
);

export const ETHNICITY: DeclaredDataset = {
	type: "ethnicity",
	module: "population",
	payload: {
		parts: yearParts(
			"ethnicity",
			"localAuthority",
			2024,
			{ coverageCountries: ["GB-ENG", "GB-WLS"] },
			["2021"],
		),
		/** Each group's entries carry their label and the census's code. */
		fill: (record) => {
			for (const group of Object.values(record))
				for (const [name, entry] of Object.entries(
					group as Record<string, Record<string, Json>>,
				)) {
					entry.ethnicity = name;
					entry.code = ETHNICITY_CODES[name];
				}
		},
		/** The largest group in each area. */
		summary: (records) => ({
			results: Object.fromEntries(
				Object.entries(records).map(([code, record]) => {
					let largest = "";
					let most = -1;
					for (const group of Object.values(
						record as Record<string, Record<string, Json>>,
					))
						for (const [name, entry] of Object.entries(group))
							if (
								(entry as { population: number }).population >
								most
							) {
								most = (entry as { population: number })
									.population;
								largest = name;
							}
					return [code, largest];
				}),
			),
		}),
	},
	...districts2021,
	period: census2021,
	measures: [USUAL_RESIDENTS],
	dimensions: [{ slug: "ethnic-group", label: "Ethnic group" }],
	fields: [
		{
			path: "{ethnic-group}.{ethnic-group}.population",
			measure: "usual-residents",
		},
	],
};

export const GENERAL_HEALTH: DeclaredDataset = {
	type: "generalHealth",
	module: "health",
	payload: {
		parts: yearParts(
			"generalHealth",
			"lsoa",
			2021,
			{
				coverageCountries: ["GB-ENG", "GB-WLS"],
			},
			["2021"],
		),
		code: "code",
	},
	period: census2021,
	name: "name",
	measures: [USUAL_RESIDENTS],
	dimensions: [
		{
			slug: "general-health",
			label: "General health",
			members: [
				{ key: "total", code: "total", label: "All usual residents" },
				{
					key: "veryGood",
					code: "very-good",
					label: "Very good health",
					parent: "total",
				},
				{
					key: "good",
					code: "good",
					label: "Good health",
					parent: "total",
				},
				{
					key: "fair",
					code: "fair",
					label: "Fair health",
					parent: "total",
				},
				{
					key: "bad",
					code: "bad",
					label: "Bad health",
					parent: "total",
				},
				{
					key: "veryBad",
					code: "very-bad",
					label: "Very bad health",
					parent: "total",
				},
			],
		},
	],
	fields: [{ path: "metrics.{general-health}", measure: "usual-residents" }],
	derived: {
		"metrics.goodHealth": "Very good plus good health.",
		value: "Good health as a percentage of all usual residents.",
	},
	computed: {
		"metrics.goodHealth": (record) => {
			const metrics = record.metrics as Record<string, number>;
			return metrics.veryGood + metrics.good;
		},
		value: (record) => {
			const metrics = record.metrics as Record<string, number>;
			return (metrics.goodHealth / metrics.total) * 100;
		},
	},
};

export const HOUSING_TENURE: DeclaredDataset = {
	type: "housingTenure",
	module: "housing",
	payload: {
		parts: yearParts(
			"housingTenure",
			"lsoa",
			2021,
			{
				coverageCountries: ["GB-ENG", "GB-WLS"],
			},
			["2021"],
		),
		code: "code",
	},
	period: census2021,
	name: "name",
	measures: [HOUSEHOLDS],
	dimensions: [
		{
			slug: "tenure",
			label: "Tenure",
			members: [
				{ key: "total", code: "total", label: "All households" },
				{
					key: "owned",
					code: "owned",
					label: "Owned",
					parent: "total",
				},
				{
					key: "outright",
					code: "owned-outright",
					label: "Owns outright",
					parent: "owned",
				},
				{
					key: "mortgage",
					code: "owned-with-mortgage",
					label: "Owns with a mortgage or loan",
					parent: "owned",
				},
				{
					key: "shared",
					code: "shared-ownership",
					label: "Shared ownership",
					parent: "total",
				},
				{
					key: "social",
					code: "social-rented",
					label: "Social rented",
					parent: "total",
				},
				{
					key: "private",
					code: "private-rented",
					label: "Private rented",
					parent: "total",
				},
				{
					key: "rentFree",
					code: "rent-free",
					label: "Lives rent free",
					parent: "total",
				},
			],
		},
	],
	fields: [{ path: "metrics.{tenure}", measure: "households" }],
	derived: { value: "Owned households as a percentage of all households." },
	computed: {
		value: (record) => {
			const metrics = record.metrics as Record<string, number>;
			return (metrics.owned / metrics.total) * 100;
		},
	},
};
