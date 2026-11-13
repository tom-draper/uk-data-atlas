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
 * A dataset source folder: the folder, the dataset ids it feeds, and the task
 * that renames it to the dataset id. Every folder sits under its theme and
 * topic; most still carry the name they had before the move, so they name
 * task 6. A folder named after its dataset leaves the task out.
 */
export type DatasetSource = readonly [
	folder: string,
	datasets: readonly string[],
	layoutTask?: 6,
];

export const DATASET_SOURCES: readonly DatasetSource[] = [
	["population/population-estimates/ts001", ["census-2021-ts001"], 6],
	["population/population-estimates/ts003", ["census-2021-ts003"], 6],
	["population/population-estimates/ts007a", ["census-2021-ts007a"], 6],
	["population/ethnicity-and-identity/ts021", ["census-2021-ts021"], 6],
	["health/health-status/ts037", ["census-2021-ts037", "general-health"], 6],
	["housing/housing-stock/ts054", ["census-2021-ts054", "housing-tenure"], 6],
	["economy/labour-market/ts066", ["census-2021-ts066"], 6],
	["population/ethnicity-and-identity/ts021-ethnic-group", ["ethnicity"], 6],
	["population/population-estimates/uk", ["population-uk"], 6],
	[
		"population/population-estimates/population-constituency-estimates",
		["population-constituency"],
		6,
	],
	[
		"population/population-estimates/population-ward-estimates",
		["population"],
		6,
	],
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
	["housing/prices-and-affordability/mean-price-by-ward", ["house-price"], 6],
	[
		"housing/prices-and-affordability/median-price-by-ward",
		["house-price"],
		6,
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
		6,
	],
	["economy/labour-market/model-based", ["unemployment"], 6],
	[
		"housing/prices-and-affordability/housing-affordability",
		["housing-affordability"],
	],
	[
		"education/schools/ks4-constituency",
		["school-performance-constituency"],
		6,
	],
	[
		"education/schools/local-authority-district",
		["school-performance", "school-performance-disadvantage"],
		6,
	],
	["education/schools/pupil-attendance", ["pupil-absence"], 6],
	["education/qualifications/qualification", ["qualification"]],
	["environment/air-quality/air-quality", ["air-quality"]],
	[
		"environment/energy/energy-consumption",
		["electricity-consumption", "gas-consumption"],
		6,
	],
	["environment/emissions/ghg-emissions", ["ghg-emissions"]],
	["environment/waste/waste", ["waste"]],
	["core/land-area", ["land-area"]],
	["health/social-care/activity", ["adult-social-care-activity"], 6],
	["health/social-care/ascof", ["adult-social-care-outcomes"], 6],
	[
		"health/life-expectancy/life-expectancy",
		["life-expectancy", "life-expectancy-series"],
	],
	["health/nhs-services/nhs-waiting-times", ["nhs-waiting"], 6],
	[
		"health/health-status/public-health-outcomes-framework",
		["public-health"],
		6,
	],
	["housing/planning/planning-applications", ["planning-applications"]],
	[
		"politics/general-elections/1918-2019",
		["historical-general-election"],
		6,
	],
	...["2010", "2015", "2017", "2019", "2024"].map(
		(year) =>
			[
				`politics/general-elections/${year}`,
				["general-election"],
				6,
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
				`politics/local-elections/${year}`,
				["local-election"],
				6,
			] as const,
	),
	["politics/referendums/constituencies-2016", ["brexit-constituency"], 6],
	["politics/referendums/local-authorities-2016", ["brexit"], 6],
	["infrastructure/digital-connectivity/broadband", ["broadband"]],
	["infrastructure/digital-connectivity/mobile", ["mobile-coverage"], 6],
	["transport/vehicles/car-availability", ["car-availability"]],
	[
		"transport/vehicles/electric-vehicle-chargers",
		["electric-vehicle-chargers"],
	],
	["transport/road-safety/road-safety", ["road-collisions"], 6],
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
