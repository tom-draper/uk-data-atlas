import {
	SCOTLAND,
	NORTHERN_IRELAND,
	SDC,
	NI_SDC,
	STANDALONE_NATION_CENSUS,
	nationCensusTitle,
	type StandaloneNationCensus,
} from "@uk-data-atlas/datasets";
import type { DatasetTopic, SourceName } from "@uk-data-atlas/datasets";
import {
	CENSUS_SMALL_AREA_TABLES,
	type CensusTable,
} from "./censusSmallAreaTables.ts";

/**
 * The census tables of Scotland (2022) and Northern Ireland (2021) on data
 * zones or local government districts.
 *
 * A joined table uses the same universe as its England and Wales
 * counterpart. A category the England and Wales
 * table also publishes borrows its suffix, label and member from it, so the
 * measure it feeds is the same measure and the two nations' series differ only
 * in the dataset and the geography. A category the nations define differently
 * is never approximated to an England and Wales one. Where a nation publishes
 * a category more finely (Scotland's single years of age, dependent children
 * by number, shared equity) or differently (Scotland's combined social
 * renting) it carries its own label and is published as a measure and member
 * of its own, nested under the England and Wales category it refines.
 *
 * Standalone tables retain their publisher's category vocabulary.
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
	joins: Pick<
		CensusTable,
		| "table"
		| "measure"
		| "measurePrefix"
		| "dimension"
		| "unit"
		| "categories"
	>;
	standalone?: true;
	/** NISRA table published on 2014 local government districts. */
	districts?: true;
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

const standalone = (table: StandaloneNationCensus): CensusNationTable => {
	const title = nationCensusTitle(table);
	const categories = table.categories.map(
		(category): CensusNationTable["categories"][number] => {
			if (typeof category !== "string" && category.length === 3)
				return category;
			const [source, label] =
				typeof category === "string" ? [category, category] : category;
			const suffix = label
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "");
			return [suffix, source, label];
		},
	);
	if (
		new Set(categories.map(([suffix]) => suffix)).size !== categories.length
	)
		throw new Error(`${table.dataset}: duplicate category keys`);
	return {
		...table,
		categories,
		title,
		description: `${title}. Table ${table.table}. Universe: ${table.universe}.`,
		standalone: true,
		joins: {
			table: table.table,
			measure: table.dataset,
			measurePrefix: table.dataset,
			dimension: table.dataset,
			unit: "count",
			categories: [],
		},
	};
};

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
			"Usual residents in Scotland by age in five-year bands, all people. NRS table UV102b. As at Census Day, 20 March 2022. Scotland publishes ages 15, 16 to 17 and 18 to 19 in place of the 15 to 19 band.",
		entry: "Table UV102b - Age (20) by sex.csv",
		topic: "population-estimates",
		joins: ew("ts007a"),
		universe: "All usual residents, by age on Census Day, 20 March 2022.",
		categories: [
			["0-to-4", "0 - 4|All people"],
			["5-to-9", "5 - 9|All people"],
			["10-to-14", "10 - 14|All people"],
			["15", "15|All people", "Aged 15"],
			["16-to-17", "16 - 17|All people", "Aged 16 to 17"],
			["18-to-19", "18 - 19|All people", "Aged 18 to 19"],
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
			"Scotland publishes ages 15, 16 to 17 and 18 to 19 in place of the 15 to 19 band, so they are published as ages of their own. The sum of three disclosure-controlled cells is not the figure for the band.",
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
			"Occupied households in Scotland by tenure. NRS table UV404. As at Census Day, 20 March 2022. Scotland counts shared equity apart from owning with a mortgage, and combines council and housing association renting.",
		entry: "Table UV404 - Household tenure - Households.csv",
		topic: "housing-stock",
		joins: ew("ts054"),
		universe: "All occupied households, each counted once.",
		categories: [
			["owned-outright", "Owned: Owned outright"],
			[
				"owned-with-mortgage-excluding-shared-equity",
				"Owned: Owned with a mortgage or loan",
				"Owned with a mortgage or loan, excluding shared equity",
			],
			[
				"shared-equity",
				"Owned: Shared Equity (e.g. LIFT or Help-to-Buy)",
				"Shared equity, such as LIFT or Help to Buy",
			],
			[
				"social-rented",
				"Social Rented: Council (LA) or Housing Association/ Registered Social Landlord",
				"Social rented from a council or housing association",
			],
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
			"Scotland counts shared equity, such as Help to Buy, as a category of its own, where England and Wales count it with owning with a mortgage or loan, so Scotland's owned with a mortgage or loan excludes it and is not the England and Wales category. Scotland publishes council and housing association renting as one figure, so it is not either England and Wales social rented category.",
		],
	},
	{
		...SCOTLAND,
		dataset: "census-2022-scotland-uv113",
		table: "UV113",
		title: "Scotland's Census 2022 household composition",
		description:
			"Households in Scotland by composition. NRS table UV113. As at Census Day, 20 March 2022. Scotland splits households with dependent children into one and two or more, and splits the other household types differently from England and Wales.",
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
			[
				"married-one-dependent-child",
				"One family household: Married or civil partnership couple: One dependent child",
				"Married or civil partnership couple, one dependent child",
			],
			[
				"married-two-plus-dependent-children",
				"One family household: Married or civil partnership couple: Two or more dependent children",
				"Married or civil partnership couple, two or more dependent children",
			],
			[
				"cohabiting-one-dependent-child",
				"One family household: Cohabiting couple: One dependent child",
				"Cohabiting couple, one dependent child",
			],
			[
				"cohabiting-two-plus-dependent-children",
				"One family household: Cohabiting couple: Two or more dependent children",
				"Cohabiting couple, two or more dependent children",
			],
			[
				"lone-parent-one-dependent-child",
				"One family household: Lone parent family: One dependent child",
				"Lone parent, one dependent child",
			],
			[
				"lone-parent-two-plus-dependent-children",
				"One family household: Lone parent family: Two or more dependent children",
				"Lone parent, two or more dependent children",
			],
			[
				"other-one-dependent-child",
				"Other household types: One dependent child",
				"Other household type, one dependent child",
			],
			[
				"other-two-plus-dependent-children",
				"Other household types: Two or more dependent children",
				"Other household type, two or more dependent children",
			],
			[
				"other-all-students",
				"Other household types: All full-time students",
				"Other household type, all full-time students",
			],
			[
				"other-all-66-plus",
				"Other household types: All aged 66 and over",
				"Other household type, all aged 66 or over",
			],
			[
				"other-remaining",
				"Other household types: Other",
				"Other household type, none of the above",
			],
		],
		notes: [
			SDC,
			"Scotland splits households with dependent children into one and two or more, which England and Wales publish as one category, and so publishes the splits as categories of their own. The other household types are split into those with one or two or more dependent children, all full-time students, all aged 66 and over, and the rest, which is not how England and Wales group them.",
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
	...STANDALONE_NATION_CENSUS.map(standalone),
	{
		...NORTHERN_IRELAND,
		dataset: "census-2021-ni-e15",
		table: "MS-E15",
		title: "Northern Ireland Census 2021 household tenure",
		description:
			"NISRA table MS-E15 counts households by tenure on Census Day, 21 March 2021.",
		entry: "census-2021-ms-e15.xlsx",
		archive: NORTHERN_IRELAND.archive.replace("phase-1", "phase-2"),
		districts: true,
		topic: "housing-stock",
		joins: ew("ts054"),
		universe: "All households.",
		categories: [
			["total", "All households"],
			["owned-outright", "Owner occupied: Owns outright"],
			[
				"ni-owned-with-mortgage",
				"Owner occupied: Owns with a mortgage or loan",
				"Northern Ireland: Owns with a mortgage or loan",
			],
			["shared-ownership", "Shared ownership: Part-owns and part-rents"],
			[
				"ni-housing-executive",
				"Social rented: Northern Ireland Housing Executive",
				"Social rented from the Northern Ireland Housing Executive",
			],
			[
				"ni-housing-association",
				"Social rented: Housing association or charitable trust",
				"Social rented from a housing association or charitable trust",
			],
			[
				"ni-private-landlord",
				"Private rented: Private landlord",
				"Private rented from a landlord in Northern Ireland",
			],
			[
				"ni-letting-agency",
				"Private rented: Letting agency",
				"Private rented from a letting agency in Northern Ireland",
			],
			[
				"ni-private-employer",
				"Private rented: Employer of a household member",
				"Private rented from a household member's employer in Northern Ireland",
			],
			[
				"ni-private-relative-or-friend",
				"Private rented: Relative or friend of a household member",
				"Private rented from a household member's relative or friend in Northern Ireland",
			],
			[
				"ni-private-other",
				"Private rented: Other",
				"Other private rented accommodation in Northern Ireland",
			],
			["rent-free", "Lives rent free"],
		],
		notes: [
			NI_SDC,
			"Published on the 11 local government districts. The social and private rental categories retain NISRA's splits.",
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

/** The artifact name of a nation table on its published geography. */
export const censusNationArtifactName = (
	table: CensusNationTable,
	boundaryYear: number,
) =>
	`${table.dataset}-${table.districts ? "local-authority" : "data-zone"}-${boundaryYear}-table`;

/** The categories only the nation publishes, each with the label of its measure. */
export const censusNationOnlyCategories = (table: CensusNationTable) =>
	table.categories.flatMap(([suffix, , label]) =>
		label === undefined ? [] : [{ suffix, label }],
	);
