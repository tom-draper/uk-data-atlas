/**
 * The one place themes, foundation parts and topics are defined. Ids, labels,
 * descriptions and display order are never repeated elsewhere. The rules for
 * using them are in `docs/data-organisation.md`.
 *
 * A theme is a broad subject area. The list is closed and changes only by
 * product decision. A topic is a subject within a theme; every dataset will
 * have exactly one primary topic. Foundation parts (`core`, `boundaries`,
 * `postcodes`) are data every theme depends on, so they are not themes.
 *
 * Display order is the order of each list below. Reorder by moving an entry.
 */

interface ThemeDefinition {
	readonly id: string;
	readonly label: string;
	readonly description: string;
}

interface FoundationPartDefinition extends ThemeDefinition {
	/** True when every download contains it. */
	readonly alwaysIncluded: boolean;
}

/**
 * A module cut out of a theme's module once the theme grows too large or
 * carries a licence the rest does not (docs/data-organisation.md, "Modules").
 * It keeps the theme and the topics of the datasets it holds, so the website's
 * sections, which follow themes and topics, do not change.
 */
interface SplitModuleDefinition extends ThemeDefinition {
	readonly theme: DatasetTheme;
	/**
	 * `datasets`: the datasets listed are held in full here, and this module is
	 * their home. `licensed-rows`: the datasets stay in `requires`, and this
	 * module holds only their rows under `licence`.
	 */
	readonly holds: "datasets" | "licensed-rows";
	readonly datasets: readonly string[];
	/** Modules a download needs beside core. */
	readonly requires: readonly DatasetTheme[];
	/** For `licensed-rows`: the licence id (`MODULE_LICENCES`) of the rows held. */
	readonly licence?: string;
	/**
	 * For `licensed-rows`: the rows held are those of the elections polled
	 * from `from` to `to`, as ISO dates (inclusive). A dataset's licence is a
	 * string in its source ("CC BY-SA 3.0 (2016–2019)"), so the range is
	 * declared here; tests/data/datasetOrganisation.test.ts keeps it in step.
	 */
	readonly electionDates?: { readonly from: string; readonly to: string };
}

interface TopicDefinition {
	readonly id: string;
	readonly theme: DatasetTheme;
	readonly label: string;
	readonly description: string;
}

const THEME_DEFINITIONS = [
	{
		id: "population",
		label: "People and population",
		description: "How many people live where, and who they are.",
	},
	{
		id: "economy",
		label: "Economy and work",
		description:
			"Jobs, pay, businesses, economic output and public finance.",
	},
	{
		id: "housing",
		label: "Housing",
		description: "Homes: what they cost, who lives in them and how many.",
	},
	{
		id: "health",
		label: "Health and care",
		description: "Health status, life expectancy, NHS services and care.",
	},
	{
		id: "education",
		label: "Education",
		description: "Schools, attendance, attainment and qualifications.",
	},
	{
		id: "society",
		label: "Society and communities",
		description: "Deprivation, poverty, crime and community life.",
	},
	{
		id: "politics",
		label: "Elections and democracy",
		description: "Elections and referendums.",
	},
	{
		id: "environment",
		label: "Environment and energy",
		description: "Air quality, emissions, energy use and waste.",
	},
	{
		id: "transport",
		label: "Transport",
		description: "How people travel, what they travel in and road safety.",
	},
	{
		id: "infrastructure",
		label: "Infrastructure",
		description: "Digital connectivity and the networks places rely on.",
	},
] as const satisfies readonly ThemeDefinition[];

const FOUNDATION_PART_DEFINITIONS = [
	{
		id: "core",
		label: "Core",
		description:
			"Areas, releases, crosswalks, lookups, named places, the catalogue of every module and denominators. Always included.",
		alwaysIncluded: true,
	},
	{
		id: "boundaries",
		label: "Boundaries",
		description: "Boundary geometry (GeoParquet). Large.",
		alwaysIncluded: false,
	},
	{
		id: "postcodes",
		label: "Postcodes",
		description: "Postcode lookups (ONSPD). Large.",
		alwaysIncluded: false,
	},
] as const satisfies readonly FoundationPartDefinition[];

export type DatasetTheme = (typeof THEME_DEFINITIONS)[number]["id"];
export type DatasetFoundationPart =
	(typeof FOUNDATION_PART_DEFINITIONS)[number]["id"];

/**
 * Modules cut out of a theme, in display order. The first split is by size:
 * `population` (7.0 of 10.7 million observations, 715 MB) is divided so that
 * single-year-of-age and small-area census data can be left out. The second is
 * by licence: the CC BY-SA local elections (2016 to 2019) are an add-on, so
 * ShareAlike does not apply to the rest of `politics`.
 */
const SPLIT_MODULE_DEFINITIONS = [
	{
		id: "population-detail",
		theme: "population",
		label: "Population detail",
		description:
			"Population by single year of age and sex for wards and local authorities, and Census 2021 tables for lower and middle layer super output areas. The bulk of the population data.",
		holds: "datasets",
		datasets: [
			"population",
			"population-uk",
			"census-2021-ts001",
			"census-2021-ts003",
			"census-2021-ts007a",
			"census-2021-ts021",
		],
		requires: [],
	},
	{
		id: "politics-sharealike",
		theme: "politics",
		label: "Local elections 2016 to 2019 (ShareAlike)",
		description:
			"Ward-level local election results for 2016 to 2019 from the Local Elections Archive Project, under CC BY-SA 3.0. An add-on to politics: anything built from it must be shared under the same licence.",
		holds: "licensed-rows",
		datasets: ["local-election"],
		requires: ["politics"],
		licence: "cc-by-sa-3.0",
		electionDates: { from: "2016-01-01", to: "2019-12-31" },
	},
] as const satisfies readonly SplitModuleDefinition[];

export type DatasetSplitModule =
	(typeof SPLIT_MODULE_DEFINITIONS)[number]["id"];

/** An id the module registry accepts: a theme, a foundation part or a split. */
export type DatasetModule =
	DatasetTheme | DatasetFoundationPart | DatasetSplitModule;

const TOPIC_DEFINITIONS = [
	// population
	{
		id: "population-estimates",
		theme: "population",
		label: "Population estimates",
		description: "How many people live in each area, by age and sex.",
	},
	{
		id: "ethnicity-and-identity",
		theme: "population",
		label: "Ethnicity and identity",
		description: "Ethnic group and other aspects of identity.",
	},
	// economy
	{
		id: "labour-market",
		theme: "economy",
		label: "Labour market",
		description: "Who is in work, out of work or claiming support.",
	},
	{
		id: "earnings-and-income",
		theme: "economy",
		label: "Earnings and income",
		description: "What people earn and what households have to spend.",
	},
	{
		id: "business",
		theme: "economy",
		label: "Business",
		description: "How many businesses there are and what they do.",
	},
	{
		id: "economic-output",
		theme: "economy",
		label: "Economic output",
		description: "Gross domestic product and value added by area.",
	},
	{
		id: "public-finance",
		theme: "economy",
		label: "Public finance",
		description: "Local government income, spending and borrowing.",
	},
	// housing
	{
		id: "prices-and-affordability",
		theme: "housing",
		label: "Prices and affordability",
		description: "What homes cost to buy and how that compares with pay.",
	},
	{
		id: "housing-stock",
		theme: "housing",
		label: "Housing stock",
		description:
			"The homes that exist: tenure, council tax bands and new supply.",
	},
	{
		id: "planning",
		theme: "housing",
		label: "Planning",
		description: "Planning applications and decisions.",
	},
	{
		id: "homelessness",
		theme: "housing",
		label: "Homelessness",
		description: "Households owed help because they are homeless.",
	},
	// health
	{
		id: "health-status",
		theme: "health",
		label: "Health status",
		description:
			"How healthy people say they are, and public health outcomes.",
	},
	{
		id: "life-expectancy",
		theme: "health",
		label: "Life expectancy",
		description: "How long people are expected to live.",
	},
	{
		id: "nhs-services",
		theme: "health",
		label: "NHS services",
		description: "Waiting times and activity in NHS services.",
	},
	{
		id: "social-care",
		theme: "health",
		label: "Social care",
		description: "Adult social care activity and outcomes.",
	},
	// education
	{
		id: "schools",
		theme: "education",
		label: "Schools",
		description: "School results and pupil attendance.",
	},
	{
		id: "qualifications",
		theme: "education",
		label: "Qualifications",
		description: "The highest qualification people hold.",
	},
	// society
	{
		id: "deprivation",
		theme: "society",
		label: "Deprivation",
		description: "Indices of multiple deprivation for each nation.",
	},
	{
		id: "poverty",
		theme: "society",
		label: "Poverty",
		description: "Child poverty and fuel poverty.",
	},
	{
		id: "crime-and-justice",
		theme: "society",
		label: "Crime and justice",
		description: "Recorded crime and the justice system.",
	},
	// politics
	{
		id: "general-elections",
		theme: "politics",
		label: "General elections",
		description: "UK parliamentary election results.",
	},
	{
		id: "local-elections",
		theme: "politics",
		label: "Local elections",
		description: "Council election results.",
	},
	{
		id: "referendums",
		theme: "politics",
		label: "Referendums",
		description: "Referendum results, such as the 2016 EU vote.",
	},
	// environment
	{
		id: "air-quality",
		theme: "environment",
		label: "Air quality",
		description: "Concentrations of air pollutants.",
	},
	{
		id: "emissions",
		theme: "environment",
		label: "Emissions",
		description: "Greenhouse gas emissions by area.",
	},
	{
		id: "energy",
		theme: "environment",
		label: "Energy",
		description: "Electricity and gas consumption.",
	},
	{
		id: "waste",
		theme: "environment",
		label: "Waste",
		description: "Household waste and recycling.",
	},
	// transport
	{
		id: "commuting",
		theme: "transport",
		label: "Commuting",
		description: "How people travel to work.",
	},
	{
		id: "vehicles",
		theme: "transport",
		label: "Vehicles",
		description: "Cars owned and electric vehicle charging points.",
	},
	{
		id: "road-safety",
		theme: "transport",
		label: "Road safety",
		description: "Road collisions and casualties.",
	},
	// infrastructure
	{
		id: "digital-connectivity",
		theme: "infrastructure",
		label: "Digital connectivity",
		description: "Broadband and mobile coverage.",
	},
] as const satisfies readonly TopicDefinition[];

export type DatasetTopic = (typeof TOPIC_DEFINITIONS)[number]["id"];

export interface DatasetThemeInfo extends ThemeDefinition {
	readonly id: DatasetTheme;
	/** Position among themes, from 1. */
	readonly order: number;
}

export interface DatasetFoundationPartInfo extends FoundationPartDefinition {
	readonly id: DatasetFoundationPart;
	/** Position among foundation parts, from 1. */
	readonly order: number;
}

export interface DatasetTopicInfo {
	readonly id: DatasetTopic;
	readonly theme: DatasetTheme;
	readonly label: string;
	readonly description: string;
	/** Position within its theme, from 1. */
	readonly order: number;
}

/** Themes in display order. */
export const DATASET_THEMES: readonly DatasetThemeInfo[] =
	THEME_DEFINITIONS.map((theme, index) => ({ ...theme, order: index + 1 }));

export interface DatasetSplitModuleInfo extends SplitModuleDefinition {
	readonly id: DatasetSplitModule;
	/** Position among the splits, from 1. */
	readonly order: number;
}

/** Split modules in display order. */
export const DATASET_SPLIT_MODULES: readonly DatasetSplitModuleInfo[] =
	SPLIT_MODULE_DEFINITIONS.map((split, index) => ({
		...split,
		order: index + 1,
	}));

/** Foundation parts in display order. */
export const DATASET_FOUNDATION_PARTS: readonly DatasetFoundationPartInfo[] =
	FOUNDATION_PART_DEFINITIONS.map((part, index) => ({
		...part,
		order: index + 1,
	}));

/** Topics in display order: by theme order, then by order within the theme. */
export const DATASET_TOPICS: readonly DatasetTopicInfo[] =
	DATASET_THEMES.flatMap(({ id: theme }) =>
		TOPIC_DEFINITIONS.filter((topic) => topic.theme === theme).map(
			(topic, index) => ({ ...topic, order: index + 1 }),
		),
	);

const THEMES_BY_ID: ReadonlyMap<string, DatasetThemeInfo> = new Map(
	DATASET_THEMES.map((theme) => [theme.id, theme]),
);
const TOPICS_BY_ID: ReadonlyMap<string, DatasetTopicInfo> = new Map(
	DATASET_TOPICS.map((topic) => [topic.id, topic]),
);
const FOUNDATION_PART_IDS: ReadonlySet<string> = new Set(
	DATASET_FOUNDATION_PARTS.map(({ id }) => id),
);

export const isDatasetTheme = (value: unknown): value is DatasetTheme =>
	typeof value === "string" && THEMES_BY_ID.has(value);

export const isDatasetTopic = (value: unknown): value is DatasetTopic =>
	typeof value === "string" && TOPICS_BY_ID.has(value);

export const isDatasetFoundationPart = (
	value: unknown,
): value is DatasetFoundationPart =>
	typeof value === "string" && FOUNDATION_PART_IDS.has(value);

export const getDatasetTheme = (theme: DatasetTheme): DatasetThemeInfo =>
	THEMES_BY_ID.get(theme) as DatasetThemeInfo;

export const getDatasetTopic = (topic: DatasetTopic): DatasetTopicInfo =>
	TOPICS_BY_ID.get(topic) as DatasetTopicInfo;

/** The theme a topic belongs to. */
export const themeOfTopic = (topic: DatasetTopic): DatasetTheme =>
	getDatasetTopic(topic).theme;

/**
 * The module a dataset is stored under, and so the `dataset.module` column.
 * Its theme's module, unless a split module holds the dataset in full. A
 * `licensed-rows` split leaves the dataset where it is.
 */
export const moduleOfDataset = (dataset: {
	readonly id: string;
	readonly topic: DatasetTopic;
}): DatasetModule =>
	DATASET_SPLIT_MODULES.find(
		(split) =>
			split.holds === "datasets" && split.datasets.includes(dataset.id),
	)?.id ?? themeOfTopic(dataset.topic);

/** The split modules that hold part or all of a dataset, in display order. */
export const splitModulesOfDataset = (
	datasetId: string,
): readonly DatasetSplitModuleInfo[] =>
	DATASET_SPLIT_MODULES.filter((split) => split.datasets.includes(datasetId));

/** Every id a module can have: each theme followed by its splits, then the foundation parts. */
export const DATASET_MODULE_IDS: readonly DatasetModule[] = [
	...DATASET_THEMES.flatMap(({ id }) => [
		id,
		...DATASET_SPLIT_MODULES.filter(({ theme }) => theme === id).map(
			(split) => split.id,
		),
	]),
	...DATASET_FOUNDATION_PARTS.map(({ id }) => id),
];

/** The ids `dataset.module` accepts: a dataset's home, never an add-on. */
export const DATASET_HOME_MODULE_IDS: readonly DatasetModule[] =
	DATASET_MODULE_IDS.filter((id) =>
		DATASET_SPLIT_MODULES.every(
			(split) => split.id !== id || split.holds === "datasets",
		),
	);

export const isDatasetModule = (value: unknown): value is DatasetModule =>
	typeof value === "string" &&
	(DATASET_MODULE_IDS as readonly string[]).includes(value);

/** The topics of a theme, in display order. */
export const topicsOfTheme = (
	theme: DatasetTheme,
): readonly DatasetTopicInfo[] =>
	DATASET_TOPICS.filter((topic) => topic.theme === theme);
