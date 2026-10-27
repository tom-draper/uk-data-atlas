import { type DeclaredDataset, periods } from "../declaredStatistics";
import { HOUSEHOLDS, USUAL_RESIDENTS, measure } from "./measures";

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

export const ETHNICITY: DeclaredDataset = {
	type: "ethnicity",
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
};

export const HOUSING_TENURE: DeclaredDataset = {
	type: "housingTenure",
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
};
