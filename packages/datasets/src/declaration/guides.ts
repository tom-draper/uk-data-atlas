import { STANDALONE_NATION_CENSUS, nationCensusTitle } from "./nationCensus.ts";
import { DECLARED_GUIDES } from "./declaredGuides.ts";
import type { DatasetTopic } from "./taxonomy.ts";

/**
 * The words about each dataset, keyed by the dataset's public id: the docs and
 * `/datasets` pages read them, in the theme and topic order of the registry.
 * A declared dataset writes its own in its declaration (`guide`), generated
 * into `declaredGuides.ts` so this module needs no readers. The census tables
 * have no declaration yet, so theirs are written here.
 */
export interface DatasetGuide {
	/** The dataset's name on the docs and `/datasets` pages. */
	title: string;
	/** The one topic the dataset is filed under. */
	topic: DatasetTopic;
	/**
	 * Other topics the dataset is also listed under, as in its declaration
	 * (a test checks they agree). They only affect discovery: the primary
	 * topic decides the theme, module, source path and builds.
	 */
	related?: readonly DatasetTopic[];
	/** A plain explanation of what the dataset measures. */
	about: string;
	/**
	 * What the data is and why you'd use it, with the Atlas legend and
	 * regional summary behaviour, for the docs. Defaults to `about`.
	 */
	summary?: string;
	/**
	 * The geography the publisher released it for, when the Atlas maps it on
	 * another: crime is published for community safety partnerships and drawn
	 * on their councils.
	 */
	publishedOn?: string;
}

/** Guides of datasets with no declaration. */
const UNDECLARED_GUIDES: Readonly<Record<string, DatasetGuide>> = {
	...Object.fromEntries(
		STANDALONE_NATION_CENSUS.map((table) => [
			table.dataset,
			{
				title: nationCensusTitle(table),
				topic: table.topic,
				about: `${table.title} among ${table.universe.toLowerCase()}. Publisher table ${table.table}.`,
				publishedOn: table.districts
					? "Local government districts"
					: "Data zones",
			},
		]),
	),
	"census-2021-ni-e15": {
		title: "Northern Ireland Census 2021 household tenure",
		topic: "housing-stock",
		about: "NISRA counts of all households by tenure on Census Day 2021.",
		publishedOn: "Local government districts",
	},

	"census-2021-ts001": {
		title: "Census 2021 usual residents by residence type",
		topic: "population-estimates",
		about: "How many usual residents lived in households and in communal establishments such as care homes and student halls on Census Day 2021, for small areas in England and Wales.",
		summary:
			"Census 2021 counts of usual residents in England and Wales, split between people living in households and in communal establishments, for lower and middle layer super output areas.",
	},
	"census-2021-ts003": {
		title: "Census 2021 household composition",
		topic: "population-estimates",
		about: "How many households of each type, such as one person, couples or lone parents, there were in small areas of England and Wales on Census Day 2021.",
		summary:
			"Census 2021 counts of households in England and Wales by composition, for lower and middle layer super output areas.",
	},
	"census-2021-ts007a": {
		title: "Census 2021 age in five-year bands",
		topic: "population-estimates",
		about: "How many residents of each five-year age band lived in small areas of England and Wales on Census Day 2021.",
		summary:
			"Census 2021 counts of residents in England and Wales by age, in five-year bands, for lower and middle layer super output areas.",
	},
	"census-2021-ts021": {
		title: "Census 2021 ethnic group",
		topic: "ethnicity-and-identity",
		about: "How many residents of each ethnic group lived in small areas of England and Wales on Census Day 2021.",
		summary:
			"Census 2021 counts of residents in England and Wales by ethnic group, for lower and middle layer super output areas.",
	},
	"census-2021-ts066": {
		title: "Census 2021 economic activity status",
		topic: "labour-market",
		about: "What residents aged 16 and over in small areas of England and Wales were doing in the week before Census Day 2021: working, looking for work or economically inactive.",
		summary:
			"Census 2021 counts of residents aged 16 and over in England and Wales by economic activity, for lower and middle layer super output areas.",
	},
	"census-2022-scotland-uv101b": {
		title: "Scotland's Census 2022 usual residents by residence type",
		topic: "population-estimates",
		about: "How many usual residents lived in households and in communal establishments such as care homes and student halls on Census Day 2022, for data zones in Scotland.",
		summary:
			"Scotland's Census 2022 counts of usual residents, split between people living in households and in communal establishments, for 2022 data zones. Published by National Records of Scotland. Scotland's Census Day was 20 March 2022, a year after England, Wales and Northern Ireland.",
	},
	"census-2022-scotland-uv102b": {
		title: "Scotland's Census 2022 age in five-year bands",
		topic: "population-estimates",
		about: "How many residents of each five-year age band lived in data zones in Scotland on Census Day 2022, except ages 15 to 19.",
		summary:
			"Scotland's Census 2022 counts of residents by age in five-year bands, for 2022 data zones. Ages 15 to 19 are not included, because Scotland publishes 15, 16 to 17 and 18 to 19 separately. Published by National Records of Scotland.",
	},
	"census-2022-scotland-uv302": {
		title: "Scotland's Census 2022 general health",
		topic: "health-status",
		about: "How residents of data zones in Scotland rated their own general health in the 2022 Census, from very good to very bad.",
		summary:
			"Scotland's Census 2022 counts of residents by self-assessed general health, for 2022 data zones. Published by National Records of Scotland.",
	},
	"census-2022-scotland-uv404": {
		title: "Scotland's Census 2022 household tenure",
		topic: "housing-stock",
		about: "How many households owned outright, part owned, rented privately or lived rent free in data zones in Scotland on Census Day 2022.",
		summary:
			"Scotland's Census 2022 counts of households by tenure, for 2022 data zones. Owned with a mortgage or loan and social rented are not included, because Scotland counts shared equity apart and combines council and housing association renting. Published by National Records of Scotland.",
	},
	"census-2022-scotland-uv113": {
		title: "Scotland's Census 2022 household composition",
		topic: "population-estimates",
		about: "How many households of each type, such as one person, couples or lone parents, there were in data zones in Scotland on Census Day 2022.",
		summary:
			"Scotland's Census 2022 counts of households by composition, for 2022 data zones. Types with dependent children are not included, because Scotland counts one and two or more dependent children separately. Published by National Records of Scotland.",
	},
	"census-2021-ni-a01": {
		title: "Census 2021 Northern Ireland usual residents",
		topic: "population-estimates",
		about: "How many usual residents lived in each data zone in Northern Ireland on Census Day 2021.",
		summary:
			"Census 2021 counts of usual residents in Northern Ireland, for 2021 data zones. Published by the Northern Ireland Statistics and Research Agency.",
	},
	"census-2021-ni-e01": {
		title: "Census 2021 Northern Ireland households",
		topic: "population-estimates",
		about: "How many households there were in each data zone in Northern Ireland on Census Day 2021.",
		summary:
			"Census 2021 counts of households in Northern Ireland, for 2021 data zones. Published by the Northern Ireland Statistics and Research Agency.",
	},
	"census-2021-ts054": {
		title: "Census 2021 tenure",
		topic: "housing-stock",
		about: "How many households owned, rented or lived rent free in small areas of England and Wales on Census Day 2021.",
		summary:
			"Census 2021 counts of households in England and Wales by tenure, for lower and middle layer super output areas. Enable the Housing Tenure card to map Census 2021 LSOA percentages in England and Wales. The legend selects a category. Regional percentages divide summed category counts by summed household counts.",
	},
	"census-2021-ts037": {
		title: "Census 2021 general health",
		topic: "health-status",
		about: "How residents of small areas in England and Wales rated their own general health in the 2021 Census, from very good to very bad.",
		summary:
			"Census 2021 counts of residents in England and Wales by self-assessed general health, for lower and middle layer super output areas. Enable the General health card to map resident health categories; its regional percentages divide summed category counts by summed resident counts.",
	},
};

export const DATASET_GUIDES: Readonly<Record<string, DatasetGuide>> = {
	...DECLARED_GUIDES,
	...UNDECLARED_GUIDES,
};
