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
	/**
	 * The folder under `<theme>/<topic>/`. Left out, it is the source's own
	 * name, which is the id of the dataset it feeds. It is set only where the
	 * folder is a part of a dataset, `house-price/mean-price-by-ward`.
	 */
	readonly folder?: string;
}

const entry = (topic: SourceEntry["topic"], folder?: string): SourceEntry =>
	folder === undefined ? { topic } : { topic, folder };

/** One entry per year folder of an election, `<prefix>/<year>`. */
const years = <Prefix extends string, Year extends number>(
	prefix: Prefix,
	topic: SourceEntry["topic"],
	list: readonly Year[],
) =>
	Object.fromEntries(
		list.map((year) => [
			`${prefix}-${year}`,
			entry(topic, `${prefix}/${year}`),
		]),
	) as Record<`${Prefix}-${Year}`, SourceEntry>;

export const SOURCES = {
	// Population
	"census-2021-ts001": entry("population-estimates"),
	"census-2021-ts003": entry("population-estimates"),
	"census-2021-ts007a": entry("population-estimates"),
	"census-2021-ts021": entry("ethnicity-and-identity"),
	"census-2021-ts037": entry("health-status"),
	"census-2021-ts054": entry("housing-stock"),
	"census-2021-ts066": entry("labour-market"),
	ethnicity: entry("ethnicity-and-identity"),
	"population-uk": entry("population-estimates"),
	"population-constituency": entry("population-estimates"),
	population: entry("population-estimates"),

	// Society
	imd: entry("deprivation"),
	nimdm: entry("deprivation"),
	simd: entry("deprivation"),
	wimd: entry("deprivation"),
	"child-poverty": entry("poverty"),
	"fuel-poverty": entry("poverty"),
	crime: entry("crime-and-justice"),

	// Economy
	"business-activity": entry("business"),
	"claimant-count": entry("labour-market"),
	jobs: entry("labour-market"),
	unemployment: entry("labour-market"),
	income: entry("earnings-and-income"),
	"local-government-finance": entry("public-finance"),
	"regional-gdp": entry("economic-output"),

	// Housing
	homelessness: entry("homelessness"),
	"house-price-mean": entry(
		"prices-and-affordability",
		"house-price/mean-price-by-ward",
	),
	"house-price-median": entry(
		"prices-and-affordability",
		"house-price/median-price-by-ward",
	),
	"housing-affordability": entry("prices-and-affordability"),
	"net-additional-dwellings": entry("housing-stock"),
	"council-tax": entry("housing-stock"),
	"planning-applications": entry("planning"),

	// Education
	"school-performance": entry("schools"),
	"school-performance-constituency": entry("schools"),
	"pupil-absence": entry("schools"),
	qualification: entry("qualifications"),

	// Environment
	"air-quality": entry("air-quality"),
	"energy-consumption": entry("energy"),
	"ghg-emissions": entry("emissions"),
	waste: entry("waste"),

	// Health
	"adult-social-care-activity": entry("social-care"),
	"adult-social-care-outcomes": entry("social-care"),
	"life-expectancy": entry("life-expectancy"),
	"nhs-waiting": entry("nhs-services"),
	"public-health": entry("health-status"),

	// Politics
	"historical-general-election": entry("general-elections"),
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
	"brexit-constituency": entry("referendums"),
	brexit: entry("referendums"),

	// Infrastructure
	broadband: entry("digital-connectivity"),
	"mobile-coverage": entry("digital-connectivity"),

	// Transport
	"car-availability": entry("vehicles"),
	"electric-vehicle-chargers": entry("vehicles"),
	"road-collisions": entry("road-safety"),
	"travel-to-work": entry("commuting"),

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
	const { topic, folder = name } = SOURCES[name] as SourceEntry;
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
