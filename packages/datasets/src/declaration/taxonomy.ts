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

/** An id the `dataset.module` column accepts: a theme or a foundation part. */
export type DatasetModule = DatasetTheme | DatasetFoundationPart;

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
 * The module a topic is downloaded in. Today every theme is one module with
 * the theme's id, so this is the topic's theme. A module that splits a theme
 * will map its topics here, and nothing else changes.
 */
export const moduleOfTopic = (topic: DatasetTopic): DatasetModule =>
	themeOfTopic(topic);

/** The topics of a theme, in display order. */
export const topicsOfTheme = (
	theme: DatasetTheme,
): readonly DatasetTopicInfo[] =>
	DATASET_TOPICS.filter((topic) => topic.theme === theme);
