/**
 * Which dataset each folder in `data/source` feeds, until `meta.json` names
 * its dataset itself (docs/data-organisation.md, task 11). Folders are
 * relative to `data/source`. The boundaries, lookups and postcodes roots
 * are described by their own tests and are not listed.
 *
 * Every folder with a `meta.json` must appear here, in `SUPPORT_SOURCES` or
 * in `UNUSED_SOURCES`, so adding a source means saying what it is for. The
 * exceptions only shrink: each carries the task that removes it.
 */

/** A known exception: why it exists, and the task in the doc that removes it. */
export interface Exception {
	reason: string;
	/** Task number in docs/data-organisation.md. */
	task: number;
}

/**
 * A dataset source folder: the folder, the dataset ids it feeds, and the task
 * that moves it to `<theme>/<topic>/<dataset>`. Every folder predates that
 * layout, so each names task 5 (the move) and task 6 (the rename to the
 * dataset id). A folder that already conforms leaves the task out.
 */
export type DatasetSource = readonly [
	folder: string,
	datasets: readonly string[],
	layoutTask?: 5,
];

export const DATASET_SOURCES: readonly DatasetSource[] = [
	["demographics/census-2021-small-area/ts001", ["census-2021-ts001"], 5],
	["demographics/census-2021-small-area/ts003", ["census-2021-ts003"], 5],
	["demographics/census-2021-small-area/ts007a", ["census-2021-ts007a"], 5],
	["demographics/census-2021-small-area/ts021", ["census-2021-ts021"], 5],
	[
		"demographics/census-2021-small-area/ts037",
		["census-2021-ts037", "general-health"],
		5,
	],
	[
		"demographics/census-2021-small-area/ts054",
		["census-2021-ts054", "housing-tenure"],
		5,
	],
	["demographics/census-2021-small-area/ts066", ["census-2021-ts066"], 5],
	["demographics/ethnicity/ts021-ethnic-group", ["ethnicity"], 5],
	["demographics/population/mid-year-estimates/uk", ["population-uk"], 5],
	[
		"demographics/population/small-area-estimates/population-constituency-estimates",
		["population-constituency"],
		5,
	],
	[
		"demographics/population/small-area-estimates/population-ward-estimates",
		["population"],
		5,
	],
	["deprivation/imd", ["imd"], 5],
	["deprivation/nimdm", ["nimdm"], 5],
	["deprivation/simd", ["simd"], 5],
	["deprivation/wimd", ["wimd"], 5],
	["economics/business-activity", ["business-activity"], 5],
	["economics/child-poverty", ["child-poverty"], 5],
	["economics/claimant-count", ["claimant-count"], 5],
	["economics/crime", ["crime"], 5],
	["economics/fuel-poverty", ["fuel-poverty"], 5],
	["economics/homelessness", ["homelessness"], 5],
	["economics/housing/mean-price-by-ward", ["house-price"], 5],
	["economics/housing/median-price-by-ward", ["house-price"], 5],
	[
		"economics/housing/net-additional-dwellings",
		["net-additional-dwellings"],
		5,
	],
	["economics/income", ["income", "workplace-income"], 5],
	["economics/jobs", ["jobs"], 5],
	["economics/local-government-finance", ["local-government-finance"], 5],
	["economics/local-government-finance/council-tax", ["council-tax"], 5],
	[
		"economics/regional-gdp",
		["regional-gdp-itl1", "regional-gdp-itl2", "regional-gdp-itl3"],
		5,
	],
	["economics/unemployment/model-based", ["unemployment"], 5],
	["education/housing-affordability", ["housing-affordability"], 5],
	[
		"education/ks4-performance/ks4-constituency",
		["school-performance-constituency"],
		5,
	],
	[
		"education/ks4-performance/local-authority-district",
		["school-performance", "school-performance-disadvantage"],
		5,
	],
	["education/pupil-attendance", ["pupil-absence"], 5],
	["education/qualification", ["qualification"], 5],
	["environment/air-quality", ["air-quality"], 5],
	[
		"environment/energy-consumption",
		["electricity-consumption", "gas-consumption"],
		5,
	],
	["environment/ghg-emissions", ["ghg-emissions"], 5],
	["environment/waste", ["waste"], 5],
	["geography/land-area", ["land-area"], 5],
	["health/adult-social-care/activity", ["adult-social-care-activity"], 5],
	["health/adult-social-care/ascof", ["adult-social-care-outcomes"], 5],
	[
		"health/life-expectancy",
		["life-expectancy", "life-expectancy-series"],
		5,
	],
	["health/nhs-waiting-times", ["nhs-waiting"], 5],
	["health/public-health-outcomes-framework", ["public-health"], 5],
	["housing/planning-applications", ["planning-applications"], 5],
	[
		"politics/elections/general-elections/1918-2019",
		["historical-general-election"],
		5,
	],
	...["2010", "2015", "2017", "2019", "2024"].map(
		(year) =>
			[
				`politics/elections/general-elections/${year}`,
				["general-election"],
				5,
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
				`politics/elections/local-elections/${year}`,
				["local-election"],
				5,
			] as const,
	),
	["politics/referendum/constituencies/2016", ["brexit-constituency"], 5],
	["politics/referendum/local-authorities/2016", ["brexit"], 5],
	["telecoms/broadband", ["broadband"], 5],
	["telecoms/mobile", ["mobile-coverage"], 5],
	["transport/car-availability", ["car-availability"], 5],
	["transport/electric-vehicle-chargers", ["electric-vehicle-chargers"], 5],
	["transport/road-safety", ["road-collisions"], 5],
	["transport/travel-to-work", ["travel-to-work"], 5],
];

const CROSSWALK_INPUT: Exception = {
	reason: "Read as a crosswalk weight input, so it feeds no dataset of its own.",
	task: 5,
};

/** Sources that feed other builds, not a dataset. Task 5 files them as core. */
export const SUPPORT_SOURCES: Readonly<Record<string, Exception>> = {
	"demographics/population/census-2022-scotland-output-area": CROSSWALK_INPUT,
	"geography/population-weighted-centroids/oa-2021-ew-v4": CROSSWALK_INPUT,
	"geography/population-weighted-centroids/oa-2022-sc": CROSSWALK_INPUT,
	"housing/council-tax-stock/2026": CROSSWALK_INPUT,
	"demographics/population/census-2021-lsoa": {
		reason: "Input to a crosswalk adapter in services/api/config.",
		task: 5,
	},
	"demographics/population/census-2021-ni-data-zone": {
		reason: "Input to a crosswalk adapter in services/api/config.",
		task: 5,
	},
	"geography/historic-counties": {
		reason: "Read by the named-locations build, not a dataset.",
		task: 5,
	},
};

const NOT_BUILT: Exception = {
	reason: "Nothing reads it. Build it, move it to _staging/ or delete it.",
	task: 18,
};

/**
 * Sources nothing reads. Unused sources belong in `_staging/`; task 18
 * decides each one. The doc names eight; the other six turned up when this
 * list was written.
 */
export const UNUSED_SOURCES: Readonly<Record<string, Exception>> = {
	"health/childhood-vaccination-cover": NOT_BUILT,
	"health/english-prescribing-dataset": NOT_BUILT,
	"health/gp-appointments": NOT_BUILT,
	"health/gp-registered-patients": NOT_BUILT,
	"health/hospital-admitted-care": NOT_BUILT,
	"health/ons-deaths-by-area": NOT_BUILT,
	"health/primary-care-workforce": NOT_BUILT,
	"economics/household-economic-activity": NOT_BUILT,
	"demographics/census-2021-22-uk-wide": NOT_BUILT,
	"demographics/ethnicity/ethnic-group-by-age-and-sex": NOT_BUILT,
	"demographics/population/mid-year-estimates/england-wales": NOT_BUILT,
	"economics/unemployment/by-age-and-duration": NOT_BUILT,
	"economics/unemployment/local-indicators": NOT_BUILT,
	"environment/flood-risk": NOT_BUILT,
};
