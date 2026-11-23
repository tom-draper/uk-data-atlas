import type { DatasetTopic, SourceName } from "@uk-data-atlas/datasets";
import {
	CENSUS_SMALL_AREA_TABLES,
	type CensusTable,
} from "./censusSmallAreaTables.ts";

/**
 * The census tables of Scotland (2022) and Northern Ireland (2021) that count
 * the same thing as an England and Wales table, on data zones.
 *
 * A table is here only where its universe and its reference date agree with
 * the England and Wales table it joins. A category the England and Wales
 * table also publishes borrows its suffix, label and member from it, so the
 * measure it feeds is the same measure and the two nations' series differ only
 * in the dataset and the geography. A category the nations define differently
 * is never approximated to an England and Wales one. Where a nation publishes
 * a category more finely (Scotland's single years of age, dependent children
 * by number, shared equity) or differently (Scotland's combined social
 * renting) it carries its own label and is published as a measure and member
 * of its own, nested under the England and Wales category it refines.
 *
 * Scotland's census day was 20 March 2022. Northern Ireland's and England and
 * Wales's was 21 March 2021.
 */
export type CensusNationTable = {
	/** The dataset id, one per publisher table. */
	dataset: string;
	nation: "scotland" | "northern-ireland";
	/** The publisher's own table reference. */
	table: string;
	title: string;
	description: string;
	/** The source folder holding `archive`. */
	folder: SourceName;
	archive: string;
	/** The file inside the archive: a CSV for Scotland, an xlsx for Northern Ireland. */
	entry: string;
	/** The census year, which is also the source period of the catalogue. */
	year: 2021 | 2022;
	topic: DatasetTopic;
	related?: readonly DatasetTopic[];
	/** The England and Wales table whose measures these categories join. */
	joins: CensusTable;
	/** What the publisher counts, in the publisher's words. */
	universe: string;
	/**
	 * Each category: its suffix and where to find it in the table. In
	 * Scotland's CSV a row's labels joined with `|`, in a Northern Ireland
	 * sheet the column heading. Without a label the suffix is that of an
	 * England and Wales category. With one the nation publishes the category
	 * alone, as the measure and member of that suffix.
	 */
	categories: readonly (readonly [
		suffix: string,
		key: string,
		label?: string,
	])[];
	notes: readonly string[];
};

const ew = (table: string): CensusTable => {
	const found = CENSUS_SMALL_AREA_TABLES.find((each) => each.table === table);
	if (!found) throw new Error(`No England and Wales table ${table}`);
	return found;
};

const SCOTLAND = {
	nation: "scotland",
	folder: "census-2022-scotland-data-zone",
	archive: "Datazone2022.zip",
	year: 2022,
} as const;

const NORTHERN_IRELAND = {
	nation: "northern-ireland",
	folder: "census-2021-northern-ireland",
	archive:
		"census-2021-main-statistics-for-northern-ireland-phase-1-all-tables.zip",
	year: 2021,
} as const;

const SDC =
	"Scotland's Census 2022 applies statistical disclosure control, so cells need not add to their totals. The files show a small count removed as a dash, read here as zero.";

export const CENSUS_NATION_TABLES: readonly CensusNationTable[] = [
	{
		...SCOTLAND,
		dataset: "census-2022-scotland-uv101b",
		table: "UV101b",
		title: "Scotland's Census 2022 usual residents by residence type",
		description:
			"Usual residents in Scotland, in total and split between households and communal establishments. NRS table UV101b, all people and all ages. As at Census Day, 20 March 2022.",
		entry: "Table UV101b - Usual resident population by sex by age (6).csv",
		topic: "population-estimates",
		joins: ew("ts001"),
		universe:
			"All usual residents on Census Day, 20 March 2022, whether they lived in a household or a communal establishment.",
		categories: [
			["in-households", "All people|Total|Lives in a household"],
			[
				"in-communal-establishments",
				"All people|Total|Lives in a communal establishment",
			],
			["total", "All people|Total|All people"],
		],
		notes: [SDC],
	},
	{
		...SCOTLAND,
		dataset: "census-2022-scotland-uv102b",
		table: "UV102b",
		title: "Scotland's Census 2022 age in five-year bands",
		description:
			"Usual residents in Scotland by age in five-year bands, all people. NRS table UV102b. As at Census Day, 20 March 2022. The 15 to 19 band is not here, because Scotland publishes ages 15, 16 to 17 and 18 to 19 separately.",
		entry: "Table UV102b - Age (20) by sex.csv",
		topic: "population-estimates",
		joins: ew("ts007a"),
		universe: "All usual residents, by age on Census Day, 20 March 2022.",
		categories: [
			["0-to-4", "0 - 4|All people"],
			["5-to-9", "5 - 9|All people"],
			["10-to-14", "10 - 14|All people"],
			["20-to-24", "20 - 24|All people"],
			["25-to-29", "25 - 29|All people"],
			["30-to-34", "30 - 34|All people"],
			["35-to-39", "35 - 39|All people"],
			["40-to-44", "40 - 44|All people"],
			["45-to-49", "45 - 49|All people"],
			["50-to-54", "50 - 54|All people"],
			["55-to-59", "55 - 59|All people"],
			["60-to-64", "60 - 64|All people"],
			["65-to-69", "65 - 69|All people"],
			["70-to-74", "70 - 74|All people"],
			["75-to-79", "75 - 79|All people"],
			["80-to-84", "80 - 84|All people"],
			["85-plus", "85 and over|All people"],
		],
		notes: [
			SDC,
			"Ages 15 to 19 are left out: Scotland publishes 15, 16 to 17 and 18 to 19, and the sum of three disclosure-controlled cells is not the figure for the band.",
		],
	},
	{
		...SCOTLAND,
		dataset: "census-2022-scotland-uv302",
		table: "UV302",
		title: "Scotland's Census 2022 general health",
		description:
			"Usual residents in Scotland by their own assessment of their general health. NRS table UV302. As at Census Day, 20 March 2022.",
		entry: "Table UV302 - General health.csv",
		topic: "health-status",
		joins: ew("ts037"),
		universe:
			"All usual residents, by their own assessment of their general health.",
		categories: [
			["very-good", "Very good"],
			["good", "Good"],
			["fair", "Fair"],
			["bad", "Bad"],
			["very-bad", "Very bad"],
			["total", "All people"],
		],
		notes: [SDC],
	},
	{
		...SCOTLAND,
		dataset: "census-2022-scotland-uv404",
		table: "UV404",
		title: "Scotland's Census 2022 household tenure",
		description:
			"Occupied households in Scotland by tenure. NRS table UV404. As at Census Day, 20 March 2022. Owned with a mortgage or loan and social rented are not here, because Scotland counts shared equity apart and combines council and housing association renting.",
		entry: "Table UV404 - Household tenure - Households.csv",
		topic: "housing-stock",
		joins: ew("ts054"),
		universe: "All occupied households, each counted once.",
		categories: [
			["owned-outright", "Owned: Owned outright"],
			[
				"shared-ownership",
				"Owned: Shared ownership (part owned and part rented)",
			],
			[
				"private-rented-landlord",
				"Private rented: Private landlord or letting agency",
			],
			["private-rented-other", "Private rented: Other"],
			["rent-free", "Lives Rent Free"],
			["total", "All occupied households"],
		],
		notes: [
			SDC,
			"Left out because the two nations define them differently: owned with a mortgage or loan (Scotland counts shared equity, such as Help to Buy, as its own category, England and Wales count it here) and social rented (Scotland publishes council and housing association renting as one figure).",
		],
	},
	{
		...SCOTLAND,
		dataset: "census-2022-scotland-uv113",
		table: "UV113",
		title: "Scotland's Census 2022 household composition",
		description:
			"Households in Scotland by composition. NRS table UV113. As at Census Day, 20 March 2022. Categories split by number of dependent children are not here, because Scotland publishes one and two or more dependent children separately.",
		entry: "Table UV113 - Household composition - Households.csv",
		topic: "population-estimates",
		joins: ew("ts003"),
		universe: "All households, each counted once.",
		categories: [
			["one-person-66-plus", "One person household: Aged 66 and over"],
			["one-person-other", "One person household: Aged under 66"],
			[
				"family-all-66-plus",
				"One family household: All aged 66 and over",
			],
			[
				"married-no-children",
				"One family household: Married or civil partnership couple: No children",
			],
			[
				"married-non-dependent-children",
				"One family household: Married or civil partnership couple: All children non-dependent",
			],
			[
				"cohabiting-no-children",
				"One family household: Cohabiting couple: No children",
			],
			[
				"cohabiting-non-dependent-children",
				"One family household: Cohabiting couple: All children non-dependent",
			],
			[
				"lone-parent-non-dependent-children",
				"One family household: Lone parent family: All children non-dependent",
			],
			["total", "All households"],
		],
		notes: [
			SDC,
			"Left out: the categories with dependent children, which Scotland splits into one and two or more, and the other household types, which Scotland groups differently.",
		],
	},
	{
		...NORTHERN_IRELAND,
		dataset: "census-2021-ni-a01",
		table: "MS-A01",
		title: "Census 2021 Northern Ireland usual residents",
		description:
			"All usual residents in Northern Ireland. NISRA table MS-A01. As at Census Day, 21 March 2021.",
		entry: "census-2021-ms-a01.xlsx",
		topic: "population-estimates",
		joins: ew("ts001"),
		universe: "All usual residents on Census Day, 21 March 2021.",
		categories: [["total", "All usual residents"]],
		notes: [
			"NISRA applies statistical disclosure control to the 2021 census tables.",
		],
	},
	{
		...NORTHERN_IRELAND,
		dataset: "census-2021-ni-e01",
		table: "MS-E01",
		title: "Census 2021 Northern Ireland households",
		description:
			"All households in Northern Ireland. NISRA table MS-E01. As at Census Day, 21 March 2021.",
		entry: "census-2021-ms-e01.xlsx",
		topic: "population-estimates",
		joins: ew("ts003"),
		universe: "All households on Census Day, 21 March 2021.",
		categories: [["total", "All households"]],
		notes: [
			"NISRA applies statistical disclosure control to the 2021 census tables.",
		],
	},
];

/**
 * The members of the joined dimension for each category of a table, in
 * category order: the member the England and Wales table gives it, or for a
 * category only the nation publishes, the member of its own suffix.
 */
export const censusNationMembers = (table: CensusNationTable) =>
	table.categories.map(([suffix, , label]) => {
		// A category only the nation publishes is the member of its own suffix.
		if (label !== undefined) return { [table.joins.dimension]: suffix };
		const category = table.joins.categories.find(
			([each]) => each === suffix,
		);
		if (!category)
			throw new Error(
				`${table.dataset}: ${table.joins.table} has no category ${suffix}`,
			);
		return { [table.joins.dimension]: category[3] ?? suffix };
	});

/** The artifact name of a nation table on its data zones. */
export const censusNationArtifactName = (
	table: CensusNationTable,
	boundaryYear: number,
) => `${table.dataset}-data-zone-${boundaryYear}-table`;

/** The categories only the nation publishes, each with the label of its measure. */
export const censusNationOnlyCategories = (table: CensusNationTable) =>
	table.categories.flatMap(([suffix, , label]) =>
		label === undefined ? [] : [{ suffix, label }],
	);
