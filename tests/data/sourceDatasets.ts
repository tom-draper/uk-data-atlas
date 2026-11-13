/**
 * Which dataset each folder in `data/source` feeds, until `meta.json` names
 * its dataset itself (docs/data-organisation.md, task 11). Folders are
 * relative to `data/source`. The boundaries and postcodes roots and
 * `core/lookups` are described by their own tests and are not listed.
 *
 * Every folder with a `meta.json` must appear here or in `SUPPORT_SOURCES`,
 * or sit in `_staging/` where nothing reads it, so adding a source means
 * saying what it is for. Task 18 decides what becomes of the staged ones.
 */

/**
 * A dataset source folder: the folder, the dataset ids it feeds, and, for a
 * folder not named after a dataset, why. Every folder sits under its theme
 * and topic and is named for a dataset it feeds (docs/data-organisation.md,
 * "Layout"), or for the dataset a part belongs to, `house-price/<part>`.
 * The exceptions are listed with their reason, so each is a choice.
 */
export type DatasetSource = readonly [
	folder: string,
	datasets: readonly string[],
	exception?: string,
];

export const DATASET_SOURCES: readonly DatasetSource[] = [
	[
		"population/population-estimates/census-2021-ts001",
		["census-2021-ts001"],
	],
	[
		"population/population-estimates/census-2021-ts003",
		["census-2021-ts003"],
	],
	[
		"population/population-estimates/census-2021-ts007a",
		["census-2021-ts007a"],
	],
	[
		"population/ethnicity-and-identity/census-2021-ts021",
		["census-2021-ts021"],
	],
	[
		"health/health-status/census-2021-ts037",
		["census-2021-ts037", "general-health"],
	],
	[
		"housing/housing-stock/census-2021-ts054",
		["census-2021-ts054", "housing-tenure"],
	],
	["economy/labour-market/census-2021-ts066", ["census-2021-ts066"]],
	["population/ethnicity-and-identity/ethnicity", ["ethnicity"]],
	["population/population-estimates/population-uk", ["population-uk"]],
	[
		"population/population-estimates/population-constituency",
		["population-constituency"],
	],
	["population/population-estimates/population", ["population"]],
	["society/deprivation/imd", ["imd"]],
	["society/deprivation/nimdm", ["nimdm"]],
	["society/deprivation/simd", ["simd"]],
	["society/deprivation/wimd", ["wimd"]],
	["economy/business/business-activity", ["business-activity"]],
	["society/poverty/child-poverty", ["child-poverty"]],
	["economy/labour-market/claimant-count", ["claimant-count"]],
	["society/crime-and-justice/crime", ["crime"]],
	["society/poverty/fuel-poverty", ["fuel-poverty"]],
	["housing/homelessness/homelessness", ["homelessness"]],
	[
		"housing/prices-and-affordability/house-price/mean-price-by-ward",
		["house-price"],
	],
	[
		"housing/prices-and-affordability/house-price/median-price-by-ward",
		["house-price"],
	],
	[
		"housing/housing-stock/net-additional-dwellings",
		["net-additional-dwellings"],
	],
	["economy/earnings-and-income/income", ["income", "workplace-income"]],
	["economy/labour-market/jobs", ["jobs"]],
	[
		"economy/public-finance/local-government-finance",
		["local-government-finance"],
	],
	["housing/housing-stock/council-tax", ["council-tax"]],
	[
		"economy/economic-output/regional-gdp",
		["regional-gdp-itl1", "regional-gdp-itl2", "regional-gdp-itl3"],
		"The three ITL levels are one dataset after task 15.",
	],
	["economy/labour-market/unemployment", ["unemployment"]],
	[
		"housing/prices-and-affordability/housing-affordability",
		["housing-affordability"],
	],
	[
		"education/schools/school-performance-constituency",
		["school-performance-constituency"],
	],
	[
		"education/schools/school-performance",
		["school-performance", "school-performance-disadvantage"],
	],
	["education/schools/pupil-absence", ["pupil-absence"]],
	["education/qualifications/qualification", ["qualification"]],
	["environment/air-quality/air-quality", ["air-quality"]],
	[
		"environment/energy/energy-consumption",
		["electricity-consumption", "gas-consumption"],
		"One download feeds both datasets, and neither id names it.",
	],
	["environment/emissions/ghg-emissions", ["ghg-emissions"]],
	["environment/waste/waste", ["waste"]],
	["core/land-area", ["land-area"]],
	[
		"health/social-care/adult-social-care-activity",
		["adult-social-care-activity"],
	],
	[
		"health/social-care/adult-social-care-outcomes",
		["adult-social-care-outcomes"],
	],
	[
		"health/life-expectancy/life-expectancy",
		["life-expectancy", "life-expectancy-series"],
	],
	["health/nhs-services/nhs-waiting", ["nhs-waiting"]],
	["health/health-status/public-health", ["public-health"]],
	["housing/planning/planning-applications", ["planning-applications"]],
	[
		"politics/general-elections/historical-general-election",
		["historical-general-election"],
	],
	...["2010", "2015", "2017", "2019", "2024"].map(
		(year) =>
			[
				`politics/general-elections/general-election/${year}`,
				["general-election"],
			] as const,
	),
	...[
		"2016",
		"2017",
		"2018",
		"2019",
		"2021",
		"2022",
		"2023",
		"2024",
		"2025",
	].map(
		(year) =>
			[
				`politics/local-elections/local-election/${year}`,
				["local-election"],
			] as const,
	),
	["politics/referendums/brexit-constituency", ["brexit-constituency"]],
	["politics/referendums/brexit", ["brexit"]],
	["infrastructure/digital-connectivity/broadband", ["broadband"]],
	[
		"infrastructure/digital-connectivity/mobile-coverage",
		["mobile-coverage"],
	],
	["transport/vehicles/car-availability", ["car-availability"]],
	[
		"transport/vehicles/electric-vehicle-chargers",
		["electric-vehicle-chargers"],
	],
	["transport/road-safety/road-collisions", ["road-collisions"]],
	["transport/commuting/travel-to-work", ["travel-to-work"]],
];

const CROSSWALK_INPUT =
	"Read as a crosswalk weight input, so it feeds no dataset of its own.";

/** Sources that feed other builds, not a dataset. They live in `core/`. */
export const SUPPORT_SOURCES: Readonly<Record<string, string>> = {
	"core/census-2022-scotland-output-area": CROSSWALK_INPUT,
	"core/population-weighted-centroids/oa-2021-ew-v4": CROSSWALK_INPUT,
	"core/population-weighted-centroids/oa-2022-sc": CROSSWALK_INPUT,
	"core/council-tax-stock/2026": CROSSWALK_INPUT,
	"core/census-2021-lsoa":
		"Input to a crosswalk adapter in services/api/config.",
	"core/census-2021-ni-data-zone":
		"Input to a crosswalk adapter in services/api/config.",
	"core/historic-counties":
		"Read by the named-locations build, not a dataset.",
};
