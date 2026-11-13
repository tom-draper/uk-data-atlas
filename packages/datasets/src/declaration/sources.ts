/**
 * Where each source folder in `data/source/` lives. Code names a source by
 * its key here and never writes a path, so moving a folder is a change to
 * this file alone (docs/data-organisation.md, "Layout").
 *
 * A source sits in `<theme>/<topic>/<folder>`, with the theme taken from the
 * topic in the taxonomy. Foundation sources (denominators, lookups, centroids)
 * have the topic `core` and sit in `core/<folder>`.
 *
 * Datasets declare their topic in three places, and `measures` imports this
 * package, so the topic is repeated here. `tests/data/sourceDatasets.test.ts`
 * checks it against the topic each dataset declares.
 */
import { themeOfTopic, type DatasetTopic } from "./taxonomy.ts";

interface SourceEntry {
	/** The topic of the dataset the folder feeds, or `core` for foundation data. */
	readonly topic: DatasetTopic | "core";
	/** The folder name under `<theme>/<topic>/`. */
	readonly folder: string;
}

const entry = (topic: SourceEntry["topic"], folder: string): SourceEntry => ({
	topic,
	folder,
});

/** One entry per year folder of an election, named `<prefix>-<year>`. */
const years = <Prefix extends string, Year extends number>(
	prefix: Prefix,
	topic: SourceEntry["topic"],
	list: readonly Year[],
) =>
	Object.fromEntries(
		list.map((year) => [`${prefix}-${year}`, entry(topic, String(year))]),
	) as Record<`${Prefix}-${Year}`, SourceEntry>;

export const SOURCES = {
	// Population
	"census-2021-ts001": entry("population-estimates", "ts001"),
	"census-2021-ts003": entry("population-estimates", "ts003"),
	"census-2021-ts007a": entry("population-estimates", "ts007a"),
	"census-2021-ts021": entry("ethnicity-and-identity", "ts021"),
	"census-2021-ts037": entry("health-status", "ts037"),
	"census-2021-ts054": entry("housing-stock", "ts054"),
	"census-2021-ts066": entry("labour-market", "ts066"),
	ethnicity: entry("ethnicity-and-identity", "ts021-ethnic-group"),
	"population-uk": entry("population-estimates", "uk"),
	"population-constituency": entry(
		"population-estimates",
		"population-constituency-estimates",
	),
	population: entry("population-estimates", "population-ward-estimates"),

	// Society
	imd: entry("deprivation", "imd"),
	nimdm: entry("deprivation", "nimdm"),
	simd: entry("deprivation", "simd"),
	wimd: entry("deprivation", "wimd"),
	"child-poverty": entry("poverty", "child-poverty"),
	"fuel-poverty": entry("poverty", "fuel-poverty"),
	crime: entry("crime-and-justice", "crime"),

	// Economy
	"business-activity": entry("business", "business-activity"),
	"claimant-count": entry("labour-market", "claimant-count"),
	jobs: entry("labour-market", "jobs"),
	unemployment: entry("labour-market", "model-based"),
	income: entry("earnings-and-income", "income"),
	"local-government-finance": entry(
		"public-finance",
		"local-government-finance",
	),
	"regional-gdp": entry("economic-output", "regional-gdp"),

	// Housing
	homelessness: entry("homelessness", "homelessness"),
	"house-price-mean": entry("prices-and-affordability", "mean-price-by-ward"),
	"house-price-median": entry(
		"prices-and-affordability",
		"median-price-by-ward",
	),
	"housing-affordability": entry(
		"prices-and-affordability",
		"housing-affordability",
	),
	"net-additional-dwellings": entry(
		"housing-stock",
		"net-additional-dwellings",
	),
	"council-tax": entry("housing-stock", "council-tax"),
	"planning-applications": entry("planning", "planning-applications"),

	// Education
	"school-performance": entry("schools", "local-authority-district"),
	"school-performance-constituency": entry("schools", "ks4-constituency"),
	"pupil-absence": entry("schools", "pupil-attendance"),
	qualification: entry("qualifications", "qualification"),

	// Environment
	"air-quality": entry("air-quality", "air-quality"),
	"energy-consumption": entry("energy", "energy-consumption"),
	"ghg-emissions": entry("emissions", "ghg-emissions"),
	waste: entry("waste", "waste"),

	// Health
	"adult-social-care-activity": entry("social-care", "activity"),
	"adult-social-care-outcomes": entry("social-care", "ascof"),
	"life-expectancy": entry("life-expectancy", "life-expectancy"),
	"nhs-waiting": entry("nhs-services", "nhs-waiting-times"),
	"public-health": entry("health-status", "public-health-outcomes-framework"),

	// Politics
	"historical-general-election": entry("general-elections", "1918-2019"),
	...years(
		"general-election",
		"general-elections",
		[2010, 2015, 2017, 2019, 2024],
	),
	...years(
		"local-election",
		"local-elections",
		[2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025],
	),
	"brexit-constituency": entry("referendums", "constituencies-2016"),
	brexit: entry("referendums", "local-authorities-2016"),

	// Infrastructure
	broadband: entry("digital-connectivity", "broadband"),
	"mobile-coverage": entry("digital-connectivity", "mobile"),

	// Transport
	"car-availability": entry("vehicles", "car-availability"),
	"electric-vehicle-chargers": entry("vehicles", "electric-vehicle-chargers"),
	"road-safety": entry("road-safety", "road-safety"),
	"travel-to-work": entry("commuting", "travel-to-work"),

	// Foundation: denominators, lookups and the geometry inputs of crosswalks
	lookups: entry("core", "lookups"),
	"land-area": entry("core", "land-area"),
	"census-2021-lsoa": entry("core", "census-2021-lsoa"),
	"census-2021-ni-data-zone": entry("core", "census-2021-ni-data-zone"),
	"census-2022-scotland-output-area": entry(
		"core",
		"census-2022-scotland-output-area",
	),
	"council-tax-stock": entry("core", "council-tax-stock"),
	"population-weighted-centroids": entry(
		"core",
		"population-weighted-centroids",
	),
	"historic-counties": entry("core", "historic-counties"),
	"ceremonial-counties": entry("core", "ceremonial-counties"),
} as const satisfies Record<string, SourceEntry>;

export type SourceName = keyof typeof SOURCES;

/** Joins path parts with `/`, dropping empty parts. */
const join = (...parts: readonly string[]) =>
	parts.filter((part) => part !== "").join("/");

/**
 * The folder of a source, relative to `data/source/`. Extra parts name a
 * path inside the folder.
 */
export function sourceDir(name: SourceName, ...inside: string[]): string {
	const { topic, folder } = SOURCES[name];
	return join(
		topic === "core" ? "core" : `${themeOfTopic(topic)}/${topic}`,
		folder,
		...inside,
	);
}

/** Roots of `data/source` that hold no source folders of the table. */
const OWN_ROOTS = ["boundaries", "postcodes"];

/**
 * Resolves a path written as `<source name>/<path inside the folder>`, the
 * form config files use so that they too name a source and not its place.
 * A path in the boundaries or postcodes root is already a place and is
 * returned as it is.
 */
export function sourceInput(input: string): string {
	const slash = input.indexOf("/");
	const name = slash === -1 ? input : input.slice(0, slash);
	if (OWN_ROOTS.includes(name)) return input;
	if (!Object.hasOwn(SOURCES, name))
		throw new Error(`${input} does not start with a source name`);
	return sourceDir(name as SourceName, input.slice(slash + 1));
}

/** The topic a source is filed under. */
export const sourceTopic = (name: SourceName) => SOURCES[name].topic;

/** The theme folder a source is filed under, or `core` for foundation data. */
export const sourceTheme = (name: SourceName) => {
	const { topic } = SOURCES[name];
	return topic === "core" ? "core" : themeOfTopic(topic);
};
