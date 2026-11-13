import type { DatasetTopic } from "./taxonomy.ts";
import type {
	AreaRelationship,
	CandidacyColumn,
	ContestColumn,
	StatisticsMeasure,
	StatisticsParty,
	StatisticsPeriod,
	StatusSlug,
} from "./vocabulary.ts";

/**
 * A compiled dataset JSON described as configuration and read into statistics
 * rows. The JSON is `{ [key]: { ...header, data: { [code]: record } } }`, as
 * every catalogue compiler writes it. Each number in a record must be claimed
 * by a field (as a value or an interval bound) or named as derived, so a new
 * field in the compiler output fails the build instead of going missing.
 *
 * The rows hold the same values, checked by count once written. The payload
 * the website reads is generated back from them (`declaredPayload.ts`) and the
 * build checks it against the compiled JSON by value.
 */

export type Json =
	null | boolean | number | string | Json[] | { [key: string]: Json };
export type DeclaredHeader = { [key: string]: Json };

export type DeclaredField = {
	/**
	 * Dot-separated path into a record. `{period}` binds a key to the period,
	 * and `{dimension}` binds a key to a member of that dimension. Naming a
	 * dimension twice nests the second member under the first.
	 */
	path: string;
	measure: string;
	/** Fixed dimension members, slug to member code. */
	members?: Record<string, string>;
	/** Paths to interval bounds, with the same bindings as `path`. */
	lower?: string;
	upper?: string;
	/**
	 * Wins a series that this field and another both fit when generating a
	 * payload. A series fitting several fields must fit exactly one that says
	 * this, or the build fails.
	 */
	wins?: true;
	/** The period for a `{period}` key. Defaults to the key as a calendar year. */
	period?: (key: string, header: DeclaredHeader) => StatisticsPeriod;
	/** A fixed period for this field, when it differs from the record's. */
	at?: StatisticsPeriod;
	/**
	 * A record path holding the value's status, with the JSON written there
	 * for each status. A value is `observed` unless this says otherwise.
	 */
	status?: { path: string; values: Partial<Record<StatusSlug, Json>> };
	/**
	 * The status of every value of the field, where the record holds none:
	 * an area mean the compiler averages from grid cells is `derived`.
	 */
	statusOfAll?: Exclude<StatusSlug, "observed">;
};

export type DeclaredDimension = {
	slug: string;
	label: string;
	/**
	 * Members in the publisher's order, keyed by the record key that holds
	 * them. When omitted, members are the keys found in the data, in the
	 * order first seen, with the key as label.
	 */
	members?: { key: string; code?: string; label?: string; parent?: string }[];
};

export type DeclaredRelease = { geography: string; year: number };

export type DeclaredRecords = {
	/** Header field holding records keyed by area code. */
	from: string;
	/** Defaults to the header's `boundaryType` and `boundaryYear`. */
	release?: (header: DeclaredHeader) => DeclaredRelease;
	/** Releases tried, in order, for codes not in the first. */
	alsoIn?:
		DeclaredRelease[] | ((header: DeclaredHeader) => DeclaredRelease[]);
};

export type DeclaredDataset = {
	/** The manifest `type` this describes. */
	type: string;
	/**
	 * The one topic the dataset is filed under (`docs/data-organisation.md`).
	 * The module it is packaged in, stored with it in the database, is derived
	 * from the topic (`moduleOfTopic`) and is never set by hand.
	 */
	topic: DatasetTopic;
	/** Other topics the dataset is also listed under, never the primary. */
	related?: readonly DatasetTopic[];
	measures: StatisticsMeasure[];
	dimensions?: DeclaredDimension[];
	fields:
		| DeclaredField[]
		| ((key: string, header: DeclaredHeader) => DeclaredField[]);
	/** Path patterns of numbers that are not observations, with why. */
	derived?: Record<string, string>;
	/** The period of a top-level key. Defaults to the key as a calendar year. */
	period?: (key: string, header: DeclaredHeader) => StatisticsPeriod;
	/** Defaults to `[{ from: "data" }]`. */
	records?: DeclaredRecords[];
	/** Shorthand for `alsoIn` on the default record set. */
	alsoIn?:
		DeclaredRelease[] | ((header: DeclaredHeader) => DeclaredRelease[]);
	/** Shorthand for `release` on the default record set. */
	release?: (header: DeclaredHeader) => DeclaredRelease;
	/**
	 * Record keys that are not area codes, each with the code of the area it
	 * stands for (an NHS organisation code for its board's GSS code), or a
	 * function of the key and its part's header. The key is stored per area,
	 * so rows rebuild it.
	 */
	keys?:
		| Readonly<Record<string, string>>
		| ((key: string, header: DeclaredHeader) => string);
	/** Codes in no listed release that are left out, with why. */
	exclude?: { codes: RegExp; reason: string }[];
	/**
	 * Record field holding the publisher's area name, or for a dataset with
	 * several record sets, the field of each set's records.
	 */
	name?: string | Record<string, string>;
	/**
	 * Record fields naming another area, by code and name, with the release
	 * the codes are on: one each record lies in, or the area its publisher
	 * used. Stored for datasets served from rows.
	 */
	parents?: DeclaredParent[];
	/**
	 * Header fields mapping the code of one kind of area to the key of another,
	 * such as each local authority's NHS board. Stored as relationships.
	 */
	headerRelationships?: {
		field: string;
		relation?: AreaRelationship;
		child: DeclaredRelease;
		parent: DeclaredRelease;
	}[];
	/** Store each part as an election, with its records' text in contests. */
	election?: DeclaredElection;
	/**
	 * Rules computing each `derived` pattern's number for a generated payload,
	 * from the rebuilt record, in the order listed.
	 */
	computed?: Record<string, DerivedRule>;
	/**
	 * How the payload the website reads is generated from the rows and this
	 * declaration: each part's header, the field holding the area's code, and
	 * the other facts the rows cannot say.
	 */
	payload?: DeclaredPayload;
};

export type DeclaredPayload = {
	/** The parts of the file for the periods the rows hold, in order. */
	parts: (
		labels: string[],
	) => { key: string; header: DeclaredHeader; optional?: true }[];
	/**
	 * The record field holding the area's code, or for a dataset with several
	 * record sets, the field of each set's records.
	 */
	code?: string | Record<string, string>;
	/**
	 * Header fields computed from the generated records, such as a count or
	 * average over the areas inside each area they name.
	 */
	summary?: (
		records: { [code: string]: Json },
		header: DeclaredHeader,
	) => { [field: string]: Json };
	/**
	 * Header fields of the compiled dataset that the generated payload does not
	 * have, because nothing in the rows says them. The comparison with the
	 * compiled dataset ignores them.
	 */
	dropped?: string[];
	/** Dot-separated paths of containers that are arrays. */
	arrays?: string[];
	/**
	 * Field path prefixes whose value, with no observation, is left out of the
	 * record instead of being null.
	 */
	omitMissing?: string[];
	/**
	 * The keys a field's `{period}` binding can take, when the field maps a
	 * key to a period: rows hold the period, so its key is found by trying
	 * these.
	 */
	periodKeys?: string[];
	/** Dot-separated paths that are null in every record with no value. */
	nullPaths?: string[];
	/**
	 * Leave out the periods a record has no observation in, instead of giving
	 * them null values. For a record that began later than the others, which
	 * has no earlier periods.
	 */
	sparsePeriods?: true;
	/**
	 * Also make a record of every area the publisher relates to another, even
	 * with no observation in the part. For a dataset of a single part.
	 */
	relatedRecords?: true;
	/** Dot-separated paths of arrays that every record has, empty if need be. */
	emptyArrays?: string[];
	/** Dot-separated paths of objects that every record has, empty if need be. */
	emptyObjects?: string[];
	/**
	 * Adds to a record the fixed text it carries, such as a label or a code the
	 * publisher gives each category. Runs once the record's values are placed.
	 */
	fill?: (
		record: { [key: string]: Json },
		code: string,
		/** The records of the sets generated before this one, by set. */
		earlier: { [set: string]: Json },
	) => void;
	/**
	 * Dot-separated paths a record does not have, given the kinds of
	 * relationship the publisher states for it.
	 */
	without?: (relations: ReadonlySet<string>) => string[];
};

/** A part per election, a record per contest. */
export type DeclaredElection = {
	kind: "general" | "local";
	/** The polling day of a top-level key, as `YYYY-MM-DD`. */
	date: (key: string, header: DeclaredHeader) => string;
	/** The record path holding each contest column's text. */
	contest?: Partial<Record<ContestColumn, string>>;
	/** The record path holding each column of the candidate it elected. */
	elected?: Partial<Record<CandidacyColumn, string>>;
	/**
	 * A header field holding each contest's winning party, keyed as the
	 * records are, stored as the contest's `winner`.
	 */
	results?: string;
	/** Names and colours of the parties the contests mention. */
	parties?: readonly StatisticsParty[];
	/** The geography each of these contest columns names an area of. */
	areas?: Partial<Record<"region" | "country", string>>;
};

export type DeclaredParent = {
	/** The record sets whose records name this area. Defaults to the first. */
	sets?: string[];
	/**
	 * A record that has the field with a null code and name has no such area,
	 * which the payload writes back as null.
	 */
	nullable?: true;
	/**
	 * How the area relates to the one the record names. Defaults to `parent`,
	 * the area the publisher says contains this one.
	 */
	relation?: AreaRelationship;
	/** Dot-separated path to the code; an array index is a key. */
	code: string;
	/** Absent when the record names the area by code only. */
	name?: string;
	release: DeclaredRelease;
	/** Releases tried, in order, for codes not in the first. */
	alsoIn?: DeclaredRelease[];
};

/** What a derived rule can read besides its record. */
export type DerivedContext = {
	/** The record's area code. */
	code: string;
	/** The header of the part the record is in (its year, for most datasets). */
	header: { readonly [key: string]: Json };
	/** Another dataset's compiled JSON, rebuilt from its rows. */
	dataset(slug: string): { readonly [key: string]: Json };
};

/**
 * A derived number, from the record with every stored value filled in, the
 * path of the leaf it fills (a pattern can match a leaf in every period), and
 * the record's context. `null` is a leaf whose value is missing. `undefined`
 * is a leaf that does not exist in the record, which differs from missing: the
 * record has no such key.
 */
export type DerivedRule = (
	record: { [key: string]: Json },
	path: readonly string[],
	context: DerivedContext,
) => number | null | undefined;

const pad = (value: number) => String(value).padStart(2, "0");
const lastDay = (year: number, month: number) =>
	new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Period constructors, so one label always means the same dates. */
export const periods = {
	year: (year: number): StatisticsPeriod => ({
		label: String(year),
		kind: "year",
		start: `${year}-01-01`,
		end: `${year}-12-31`,
	}),
	/** April to March, labelled `2024-25`. */
	financialYear: (start: number): StatisticsPeriod => ({
		label: `${start}-${pad((start + 1) % 100)}`,
		kind: "financial_year",
		start: `${start}-04-01`,
		end: `${start + 1}-03-31`,
	}),
	/** September to August, labelled `2024/25`. */
	academicYear: (start: number): StatisticsPeriod => ({
		label: `${start}/${pad((start + 1) % 100)}`,
		kind: "academic_year",
		start: `${start}-09-01`,
		end: `${start + 1}-08-31`,
	}),
	quarter: (year: number, quarter: number): StatisticsPeriod => ({
		label: `${year}-Q${quarter}`,
		kind: "quarter",
		start: `${year}-${pad(quarter * 3 - 2)}-01`,
		end: `${year}-${pad(quarter * 3)}-${lastDay(year, quarter * 3)}`,
	}),
	month: (year: number, month: number): StatisticsPeriod => ({
		label: `${year}-${pad(month)}`,
		kind: "month",
		start: `${year}-${pad(month)}-01`,
		end: `${year}-${pad(month)}-${lastDay(year, month)}`,
	}),
	/** Census day, labelled `2021-census`. */
	census: (year: number): StatisticsPeriod => {
		const day = { 2011: "2011-03-27", 2021: "2021-03-21" }[year];
		if (!day) throw new Error(`Unknown census day for ${year}`);
		return { label: `${year}-census`, kind: "date", start: day, end: day };
	},
	date: (date: string): StatisticsPeriod => ({
		label: date,
		kind: "date",
		start: date,
		end: date,
	}),
	/** Whole calendar years, labelled `2022-2024`. */
	years: (first: number, last: number): StatisticsPeriod => ({
		label: `${first}-${last}`,
		kind: "range",
		start: `${first}-01-01`,
		end: `${last}-12-31`,
	}),
	/** Twelve months ending with a month, labelled `year-ending-2026-03`. */
	yearEnding: (year: number, month: number): StatisticsPeriod => ({
		label: `year-ending-${year}-${pad(month)}`,
		kind: "range",
		start:
			month === 12 ? `${year}-01-01` : `${year - 1}-${pad(month + 1)}-01`,
		end: `${year}-${pad(month)}-${lastDay(year, month)}`,
	}),
};
