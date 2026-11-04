/**
 * The vocabulary of the statistics tables: measures, dimensions, periods,
 * statuses and the text a publisher gives about a contest. It holds no
 * database code, so a dataset declaration can use it beside its loader.
 */

export type ValueKind =
	| "count"
	| "rate"
	| "share"
	| "median"
	| "mean"
	| "index"
	| "rank"
	| "amount"
	| "category";
export type Aggregation = "sum" | "ratio" | "weighted_mean" | "none";
export type PeriodKind =
	| "year"
	| "financial_year"
	| "academic_year"
	| "quarter"
	| "month"
	| "date"
	| "range";
export type SeriesMethod =
	"published" | "converted" | "aggregated" | "modelled";

export const STATUSES = [
	["observed", "Observed"],
	["estimated", "Estimated"],
	["provisional", "Provisional"],
	["suppressed", "Suppressed"],
	["not_applicable", "Not applicable"],
	/** Computed by the atlas from finer published values, such as an area mean of grid cells. */
	["derived", "Derived"],
] as const;
export type StatusSlug = (typeof STATUSES)[number][0];

export type StatisticsSource = {
	publisher: string;
	url?: string;
	licence: string;
	licenceUrl?: string;
	citation?: string;
};

/** A measure is shared across datasets: `households` means the same everywhere. */
export type StatisticsMeasure = {
	slug: string;
	label: string;
	description: string;
	unit: string;
	valueKind: ValueKind;
	aggregation: Aggregation;
	/** Slugs of measures declared earlier, for `ratio` measures. */
	numerator?: string;
	denominator?: string;
};

export type StatisticsDimension = {
	slug: string;
	label: string;
	/** In the publisher's order. `parent` is the code of an earlier member. */
	members: { code: string; label: string; parent?: string }[];
};

export type StatisticsPeriod = {
	label: string;
	kind: PeriodKind;
	start: string;
	end: string;
};

/**
 * How a publisher relates one area to another: `parent` is the area that
 * contains it, `predecessor` an area it was formed from, and `published-as`
 * the area under whose code the publisher listed it, and `coterminous` an area
 * the publisher says has the same extent.
 */
export const AREA_RELATIONSHIPS = [
	"parent",
	"predecessor",
	"published-as",
	"coterminous",
] as const;
export type AreaRelationship = (typeof AREA_RELATIONSHIPS)[number];

/** A party's name and colour, by the key the atlas's payloads use for it. */
export type StatisticsParty = {
	key: string;
	name: string;
	colour?: string;
};

/** Text a publisher gives about a contest, beside its votes. */
export const CONTEST_COLUMNS = [
	/** The area's name as published for this election. */
	"area_name",
	"authority_code",
	"authority_name",
	"region",
	"country",
	"constituency_type",
	"result",
	"first_party",
	"second_party",
	/** The party the publisher declares won, by its party key. */
	"winner",
] as const;
export type ContestColumn = (typeof CONTEST_COLUMNS)[number];

/** What a publisher gives about the candidate a contest elected. */
export const CANDIDACY_COLUMNS = [
	"given_name",
	"family_name",
	"gender",
] as const;
export type CandidacyColumn = (typeof CANDIDACY_COLUMNS)[number];
