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
