import type { DatabaseSync } from "node:sqlite";

/**
 * The canonical statistics tables (layer 4 of docs/sqlite-schema-design.md):
 * datasets, measures, dimensions, series and observations as integer-keyed
 * rows. A dataset joins by describing itself as a `StatisticsDataset`; the
 * schema does not change per dataset.
 *
 * Observations key on `area_version`, a code as it appears in one release.
 * Until boundary releases get their own table, a release is a row of
 * `area_releases`.
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

export type AreaRelease = { geography: string; id: string };

/** One measure, one combination of dimension members, on one release. */
export type StatisticsSeries = {
	measure: string;
	release: AreaRelease;
	/** Dimension slug to member code. */
	members?: Record<string, string>;
	method?: SeriesMethod;
	/** Index of an earlier series of the same dataset this was derived from. */
	derivedFrom?: number;
};

/**
 * How a publisher relates one area to another: `parent` is the area that
 * contains it, `predecessor` an area it was formed from, and `published-as`
 * the area under whose code the publisher listed it.
 */
export const AREA_RELATIONSHIPS = [
	"parent",
	"predecessor",
	"published-as",
] as const;
export type AreaRelationship = (typeof AREA_RELATIONSHIPS)[number];

export type StatisticsObservation = {
	/** Index into the dataset's `series`. */
	series: number;
	/** Area code in the series' release. */
	code: string;
	period: string;
	value: number | null;
	status?: StatusSlug;
	lower?: number;
	upper?: number;
	/** Member code of `categoryDimension`, for `category` measures. */
	category?: string;
};

export type StatisticsDataset = {
	slug: string;
	title: string;
	description: string;
	source: StatisticsSource;
	released?: string;
	fingerprint: string;
	measures: StatisticsMeasure[];
	dimensions?: StatisticsDimension[];
	/** The dimension whose members `category` observations refer to. */
	categoryDimension?: string;
	periods: StatisticsPeriod[];
	series: StatisticsSeries[];
	observations: () => Iterable<StatisticsObservation>;
	/** Publisher names for areas; only those differing from the boundary name are stored. */
	areaNames?: () => Iterable<{
		release: AreaRelease;
		code: string;
		name: string;
	}>;
	/** Record keys for areas the file keys by something other than their code. */
	areaKeys?: () => Iterable<{
		release: AreaRelease;
		code: string;
		key: string;
	}>;
	/** The elections the dataset holds, each with a contest per area. */
	elections?: () => Iterable<StatisticsElection>;
	/** Areas a publisher relates to other areas, such as the one containing them. */
	relationships?: () => Iterable<{
		relation: AreaRelationship;
		/** The label of the period the publisher states it for. */
		period: string;
		child: { release: AreaRelease; code: string };
		parent: { release: AreaRelease; code: string };
	}>;
	/**
	 * How to lay the rows back out as the compiled JSON, for datasets served
	 * from rows. One layout per top-level key of the file.
	 */
	layouts?: () => Iterable<StatisticsLayout>;
	/** Runs once every row is written, before the database is published. */
	verify?: (database: DatabaseSync) => void;
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

/**
 * One leaf of a record, in the record's key order. Every record of a part has
 * the same leaves; only the area and its values change.
 */
export type StatisticsLayoutLeaf = {
	/** Keys from the record down; a key into an array is its index. */
	path: (string | number)[];
} & (
	| {
			kind: "value" | "lower" | "upper";
			/** Index into the dataset's `series`. */
			series: number;
			period: string;
	  }
	/** The JSON written for the value's status, keyed by status slug. */
	| {
			kind: "status";
			series: number;
			period: string;
			statuses: string;
	  }
	| { kind: "code" | "name" }
	/** The code or name of the record's parent area, by index into its `parents`. */
	| { kind: "parent_code" | "parent_name"; parent: number }
	/** A number computed from the record's other values, by a named rule. */
	| { kind: "derived"; rule: string }
	/** The same JSON in every record. */
	| { kind: "literal"; value: string }
	/** A column of the record's contest, or of the candidate it elected. */
	| { kind: "contest"; column: ContestColumn }
	| { kind: "candidacy"; column: CandidacyColumn }
);

/**
 * An election a dataset holds: its polling day and kind, with a contest for
 * each area. `label` is the publisher's name for the election, such as `2024`
 * or `1974O`.
 */
export type StatisticsElection = {
	label: string;
	kind: "general" | "local";
	/** The polling day, as `YYYY-MM-DD`. */
	date: string;
	/** The release the contests' areas are on. */
	release: AreaRelease;
	contests: {
		release: AreaRelease;
		code: string;
		contest?: Partial<Record<ContestColumn, string | null>>;
		/** The candidate the contest elected, when the publisher names one. */
		elected?: Partial<Record<CandidacyColumn, string | null>>;
	}[];
};

/** A top-level key of a compiled dataset: its header and record layouts. */
export type StatisticsLayout = {
	key: string;
	/** The header as JSON, with each record set's field set to null. */
	header: string;
	records: {
		from: string;
		leaves: StatisticsLayoutLeaf[];
		/** The records' areas, in the file's order, with their parent areas. */
		areas: {
			release: AreaRelease;
			code: string;
			/** Parent areas, in the dataset's order of parent fields; a record may lack one. */
			parents?: ({ release: AreaRelease; code: string } | undefined)[];
			/** Leaf positions this record lacks. */
			absent?: number[];
			contest?: Partial<Record<ContestColumn, string | null>>;
			/** The candidate the contest elected, when the record names one. */
			elected?: Partial<Record<CandidacyColumn, string | null>>;
		}[];
	}[];
};

/**
 * The areas a dataset can be placed on, read from the tables written before
 * the statistics tables. A dataset that routes codes between releases is
 * built from this, as `(areas) => StatisticsDataset`.
 */
export type AreaIndex = {
	/**
	 * The release the atlas draws for a geography and boundary year: the
	 * atlas vintage where one is declared, otherwise the one available release
	 * whose id starts with the year.
	 */
	release(geography: string, year: number): AreaRelease;
	/** The same, or nothing when the atlas holds no release for the year. */
	find(geography: string, year: number): AreaRelease | undefined;
	has(release: AreaRelease, code: string): boolean;
};

export type StatisticsInput =
	StatisticsDataset | ((areas: AreaIndex) => StatisticsDataset);

export const seriesKey = (dataset: string, series: StatisticsSeries): string =>
	[
		dataset,
		series.measure,
		`${series.release.geography}:${series.release.id}`,
		...Object.entries(series.members ?? {})
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([dimension, member]) => `${dimension}=${member}`),
	].join("/");
