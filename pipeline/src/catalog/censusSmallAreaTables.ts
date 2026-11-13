import type { DatasetTopic } from "@uk-data-atlas/datasets";

/**
 * Census 2021 tables for England and Wales at the two statistical small-area
 * geographies, read from the Nomis bulk files kept unchanged under
 * data/source/demographics/census-2021-small-area.
 *
 * Each category is a count, so it adds over areas and converts exactly
 * through a containment crosswalk. Only leaf categories are served, which
 * together make up the table's total: a subtotal would be the sum of its
 * leaves, and a caller who wants one can aggregate them without the risk of
 * adding a subtotal to its own parts.
 */
export type Category = readonly [suffix: string, column: string, label: string];

export type CensusTable = {
	table: string;
	/** The one topic the table's dataset is filed under. */
	topic: DatasetTopic;
	/** Other topics the dataset is also listed under, never the primary. */
	related?: readonly DatasetTopic[];
	/** The measure id is the prefix and the category suffix. */
	measurePrefix: string;
	unit: string;
	universe: string;
	totalColumn: string;
	categories: readonly Category[];
	notes: readonly string[];
	/**
	 * Measures published elsewhere for the same census question, which these
	 * partitions extend rather than duplicate.
	 */
	extendsExistingMeasures?: boolean;
};

export const CENSUS_SMALL_AREA_TABLES: readonly CensusTable[] = [
	{
		table: "ts001",
		topic: "population-estimates",
		measurePrefix: "usual-residents",
		unit: "usual residents",
		universe:
			"All usual residents on Census Day, 21 March 2021, whether they lived in a household or a communal establishment.",
		totalColumn: "Residence type: Total; measures: Value",
		categories: [
			[
				"in-households",
				"Residence type: Lives in a household; measures: Value",
				"Usual residents living in households",
			],
			[
				"in-communal-establishments",
				"Residence type: Lives in a communal establishment; measures: Value",
				"Usual residents living in communal establishments",
			],
			[
				"total",
				"Residence type: Total; measures: Value",
				"Usual residents",
			],
		],
		notes: [
			"A census count of usual residents on Census Day, not a mid-year population estimate; the two differ in date and method.",
			"Communal establishments include care homes, student halls, prisons and armed forces bases.",
		],
	},
	{
		table: "ts007a",
		topic: "population-estimates",
		measurePrefix: "age",
		unit: "usual residents",
		universe: "All usual residents, by age on Census Day.",
		totalColumn: "Age: Total",
		categories: [
			["0-to-4", "Age: Aged 4 years and under", "Aged 4 and under"],
			["5-to-9", "Age: Aged 5 to 9 years", "Aged 5 to 9"],
			["10-to-14", "Age: Aged 10 to 14 years", "Aged 10 to 14"],
			["15-to-19", "Age: Aged 15 to 19 years", "Aged 15 to 19"],
			["20-to-24", "Age: Aged 20 to 24 years", "Aged 20 to 24"],
			["25-to-29", "Age: Aged 25 to 29 years", "Aged 25 to 29"],
			["30-to-34", "Age: Aged 30 to 34 years", "Aged 30 to 34"],
			["35-to-39", "Age: Aged 35 to 39 years", "Aged 35 to 39"],
			["40-to-44", "Age: Aged 40 to 44 years", "Aged 40 to 44"],
			["45-to-49", "Age: Aged 45 to 49 years", "Aged 45 to 49"],
			["50-to-54", "Age: Aged 50 to 54 years", "Aged 50 to 54"],
			["55-to-59", "Age: Aged 55 to 59 years", "Aged 55 to 59"],
			["60-to-64", "Age: Aged 60 to 64 years", "Aged 60 to 64"],
			["65-to-69", "Age: Aged 65 to 69 years", "Aged 65 to 69"],
			["70-to-74", "Age: Aged 70 to 74 years", "Aged 70 to 74"],
			["75-to-79", "Age: Aged 75 to 79 years", "Aged 75 to 79"],
			["80-to-84", "Age: Aged 80 to 84 years", "Aged 80 to 84"],
			["85-plus", "Age: Aged 85 years and over", "Aged 85 and over"],
		],
		notes: [
			"Five-year bands; a wider band, such as 65 and over, is the sum of its bands and adds exactly.",
		],
	},
	{
		table: "ts003",
		topic: "population-estimates",
		measurePrefix: "household-composition",
		unit: "households",
		universe: "Households, not people: each household counts once.",
		totalColumn: "Household composition: Total; measures: Value",
		categories: [
			[
				"one-person-66-plus",
				"Household composition: One person household: Aged 66 years and over; measures: Value",
				"One-person household aged 66 or over",
			],
			[
				"one-person-other",
				"Household composition: One person household: Other; measures: Value",
				"One-person household, other",
			],
			[
				"family-all-66-plus",
				"Household composition: Single family household: All aged 66 years and over; measures: Value",
				"Single family household, all aged 66 or over",
			],
			[
				"married-no-children",
				"Household composition: Single family household: Married or civil partnership couple: No children; measures: Value",
				"Married or civil partnership couple, no children",
			],
			[
				"married-dependent-children",
				"Household composition: Single family household: Married or civil partnership couple: Dependent children; measures: Value",
				"Married or civil partnership couple, dependent children",
			],
			[
				"married-non-dependent-children",
				"Household composition: Single family household: Married or civil partnership couple: All children non-dependent; measures: Value",
				"Married or civil partnership couple, all children non-dependent",
			],
			[
				"cohabiting-no-children",
				"Household composition: Single family household: Cohabiting couple family: No children; measures: Value",
				"Cohabiting couple, no children",
			],
			[
				"cohabiting-dependent-children",
				"Household composition: Single family household: Cohabiting couple family: With dependent children; measures: Value",
				"Cohabiting couple, dependent children",
			],
			[
				"cohabiting-non-dependent-children",
				"Household composition: Single family household: Cohabiting couple family: All children non-dependent; measures: Value",
				"Cohabiting couple, all children non-dependent",
			],
			[
				"lone-parent-dependent-children",
				"Household composition: Single family household: Lone parent family: With dependent children; measures: Value",
				"Lone parent, dependent children",
			],
			[
				"lone-parent-non-dependent-children",
				"Household composition: Single family household: Lone parent family: All children non-dependent; measures: Value",
				"Lone parent, all children non-dependent",
			],
			[
				"other-family",
				"Household composition: Single family household: Other single family household: Other family composition; measures: Value",
				"Other single family household",
			],
			[
				"other-with-dependent-children",
				"Household composition: Other household types: With dependent children; measures: Value",
				"Other household type with dependent children",
			],
			[
				"other",
				"Household composition: Other household types: Other, including all full-time students and all aged 66 years and over; measures: Value",
				"Other household type, including all full-time students",
			],
			[
				"total",
				"Household composition: Total; measures: Value",
				"Households",
			],
		],
		notes: [
			"A dependent child is aged 0 to 15, or 16 to 18 in full-time education and living with a parent.",
		],
	},
	{
		table: "ts054",
		topic: "housing-stock",
		measurePrefix: "tenure",
		unit: "households",
		universe: "Households, not people: each household counts once.",
		totalColumn: "Tenure of household: Total: All households",
		categories: [
			[
				"owned-outright",
				"Tenure of household: Owned: Owns outright",
				"Owned outright",
			],
			[
				"owned-with-mortgage",
				"Tenure of household: Owned: Owns with a mortgage or loan",
				"Owned with a mortgage or loan",
			],
			[
				"shared-ownership",
				"Tenure of household: Shared ownership: Shared ownership",
				"Shared ownership",
			],
			[
				"social-rented-council",
				"Tenure of household: Social rented: Rents from council or Local Authority",
				"Social rented from a council",
			],
			[
				"social-rented-other",
				"Tenure of household: Social rented: Other social rented",
				"Other social rented",
			],
			[
				"private-rented-landlord",
				"Tenure of household: Private rented: Private landlord or letting agency",
				"Private rented from a landlord or letting agency",
			],
			[
				"private-rented-other",
				"Tenure of household: Private rented: Other private rented",
				"Other private rented",
			],
			[
				"rent-free",
				"Tenure of household: Lives rent free",
				"Lives rent free",
			],
			[
				"total",
				"Tenure of household: Total: All households",
				"Households",
			],
		],
		notes: [
			"Social rented includes housing associations as well as councils; owned covers owned outright and with a mortgage, not shared ownership.",
		],
	},
	{
		table: "ts066",
		topic: "labour-market",
		measurePrefix: "economic-activity",
		unit: "usual residents aged 16 and over",
		universe:
			"Usual residents aged 16 and over, by their activity in the week before Census Day.",
		totalColumn:
			"Economic activity status: Total: All usual residents aged 16 years and over",
		categories: [
			[
				"employed",
				"Economic activity status: Economically active (excluding full-time students):In employment",
				"In employment, excluding full-time students",
			],
			[
				"unemployed",
				"Economic activity status: Economically active (excluding full-time students): Unemployed",
				"Unemployed, excluding full-time students",
			],
			[
				"student-employed",
				"Economic activity status: Economically active and a full-time student:In employment",
				"Full-time student in employment",
			],
			[
				"student-unemployed",
				"Economic activity status: Economically active and a full-time student: Unemployed",
				"Full-time student, unemployed",
			],
			[
				"inactive-retired",
				"Economic activity status: Economically inactive: Retired",
				"Economically inactive: retired",
			],
			[
				"inactive-student",
				"Economic activity status: Economically inactive: Student",
				"Economically inactive: student",
			],
			[
				"inactive-looking-after-home",
				"Economic activity status: Economically inactive: Looking after home or family",
				"Economically inactive: looking after home or family",
			],
			[
				"inactive-long-term-sick",
				"Economic activity status: Economically inactive: Long-term sick or disabled",
				"Economically inactive: long-term sick or disabled",
			],
			[
				"inactive-other",
				"Economic activity status: Economically inactive: Other",
				"Economically inactive: other",
			],
			[
				"total",
				"Economic activity status: Total: All usual residents aged 16 years and over",
				"Usual residents aged 16 and over",
			],
		],
		notes: [
			"Census Day fell in a national lockdown, so employment in some sectors reads differently from other years.",
			"Full-time students who worked or looked for work are economically active; the census keeps them apart from other active residents, as here.",
			"An unemployment rate is unemployed over economically active, not over all residents; both are served, so a caller chooses the denominator.",
		],
	},
	{
		table: "ts021",
		topic: "ethnicity-and-identity",
		measurePrefix: "ethnicity",
		unit: "usual residents",
		universe:
			"All usual residents, as they identified themselves. The nineteen categories are exhaustive, so they sum to the whole resident population.",
		totalColumn: "Ethnic group: Total: All usual residents",
		extendsExistingMeasures: true,
		categories: [
			[
				"bangladeshi",
				"Ethnic group: Asian, Asian British or Asian Welsh: Bangladeshi",
				"Ethnic group: Bangladeshi",
			],
			[
				"chinese",
				"Ethnic group: Asian, Asian British or Asian Welsh: Chinese",
				"Ethnic group: Chinese",
			],
			[
				"indian",
				"Ethnic group: Asian, Asian British or Asian Welsh: Indian",
				"Ethnic group: Indian",
			],
			[
				"pakistani",
				"Ethnic group: Asian, Asian British or Asian Welsh: Pakistani",
				"Ethnic group: Pakistani",
			],
			[
				"other-asian",
				"Ethnic group: Asian, Asian British or Asian Welsh: Other Asian",
				"Ethnic group: Other Asian",
			],
			[
				"african",
				"Ethnic group: Black, Black British, Black Welsh, Caribbean or African: African",
				"Ethnic group: African",
			],
			[
				"caribbean",
				"Ethnic group: Black, Black British, Black Welsh, Caribbean or African: Caribbean",
				"Ethnic group: Caribbean",
			],
			[
				"other-black",
				"Ethnic group: Black, Black British, Black Welsh, Caribbean or African: Other Black",
				"Ethnic group: Other Black",
			],
			[
				"white-and-asian",
				"Ethnic group: Mixed or Multiple ethnic groups: White and Asian",
				"Ethnic group: White and Asian",
			],
			[
				"white-and-black-african",
				"Ethnic group: Mixed or Multiple ethnic groups: White and Black African",
				"Ethnic group: White and Black African",
			],
			[
				"white-and-black-caribbean",
				"Ethnic group: Mixed or Multiple ethnic groups: White and Black Caribbean",
				"Ethnic group: White and Black Caribbean",
			],
			[
				"other-mixed",
				"Ethnic group: Mixed or Multiple ethnic groups: Other Mixed or Multiple ethnic groups",
				"Ethnic group: Other Mixed or Multiple ethnic groups",
			],
			[
				"white-british",
				"Ethnic group: White: English, Welsh, Scottish, Northern Irish or British",
				"Ethnic group: English, Welsh, Scottish, Northern Irish or British",
			],
			["irish", "Ethnic group: White: Irish", "Ethnic group: Irish"],
			[
				"gypsy-or-irish-traveller",
				"Ethnic group: White: Gypsy or Irish Traveller",
				"Ethnic group: Gypsy or Irish Traveller",
			],
			["roma", "Ethnic group: White: Roma", "Ethnic group: Roma"],
			[
				"other-white",
				"Ethnic group: White: Other White",
				"Ethnic group: Other White",
			],
			[
				"arab",
				"Ethnic group: Other ethnic group: Arab",
				"Ethnic group: Arab",
			],
			[
				"any-other",
				"Ethnic group: Other ethnic group: Any other ethnic group",
				"Ethnic group: Any other ethnic group",
			],
		],
		notes: [],
	},
	{
		table: "ts037",
		topic: "health-status",
		measurePrefix: "general-health",
		unit: "usual residents",
		universe:
			"All usual residents, by their own assessment of their general health.",
		totalColumn: "General health: Total: All usual residents",
		categories: [
			[
				"very-good",
				"General health: Very good health",
				"General health: very good",
			],
			["good", "General health: Good health", "General health: good"],
			["fair", "General health: Fair health", "General health: fair"],
			["bad", "General health: Bad health", "General health: bad"],
			[
				"very-bad",
				"General health: Very bad health",
				"General health: very bad",
			],
			[
				"total",
				"General health: Total: All usual residents",
				"Usual residents",
			],
		],
		notes: [
			"Self-assessed on a five-point scale; it is not a clinical measure and was collected during the pandemic.",
		],
	},
];
