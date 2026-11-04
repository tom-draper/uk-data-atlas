import type { DatabaseSync } from "node:sqlite";
import type { DatasetModule } from "@uk-data-atlas/datasets/declaration/modules";
import { seriesKey as canonicalSeriesKey } from "./atlasStatistics.ts";
import type {
	AreaIndex,
	AreaRelease,
	CandidacyColumn,
	ContestColumn,
	StatisticsDataset,
	StatisticsElection,
	AreaRelationship,
	StatisticsDimension,
	StatisticsMeasure,
	StatisticsObservation,
	StatisticsParty,
	StatisticsPeriod,
	StatisticsSeries,
	StatusSlug,
} from "./atlasStatistics.ts";

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
	/** The topic the dataset belongs to, stored with it in the database. */
	module: DatasetModule;
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

export type DeclaredManifestEntry = {
	output: string;
	fingerprint: string;
	source: unknown;
};

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

const calendarYear = (key: string, context: string) => {
	if (!/^\d{4}$/.test(key))
		throw new Error(`${context}: ${key} is not a year; declare its period`);
	return periods.year(Number(key));
};

export const memberCode = (key: string) =>
	key
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

type Segment = { literal: string } | { binding: string };
const parsePath = (path: string): Segment[] =>
	path.split(".").map((part) => {
		const match = /^\{([a-z0-9-]+)\}$/.exec(part);
		return match ? { binding: match[1] } : { literal: part };
	});

type Match = { node: Json; path: string[]; bound: string[] };

/**
 * Every node a pattern reaches, with the keys its bindings took in order. A
 * binding over declared members only visits those keys.
 */
function* expand(
	node: Json,
	segments: readonly Segment[],
	keys: (binding: string) => ReadonlySet<string> | undefined,
	index = 0,
	path: string[] = [],
	bound: string[] = [],
): Generator<Match> {
	if (index === segments.length) {
		yield { node, path, bound };
		return;
	}
	if (node === null || typeof node !== "object") return;
	const segment = segments[index];
	if ("literal" in segment) {
		const child = (node as Record<string, Json>)[segment.literal];
		if (child !== undefined)
			yield* expand(
				child,
				segments,
				keys,
				index + 1,
				[...path, segment.literal],
				bound,
			);
		return;
	}
	const allowed = keys(segment.binding);
	for (const [key, child] of Object.entries(node))
		if (!allowed || allowed.has(key))
			yield* expand(
				child,
				segments,
				keys,
				index + 1,
				[...path, key],
				[...bound, key],
			);
}

const follow = (node: Json, path: readonly string[]): Json | undefined => {
	let current: Json | undefined = node;
	for (const key of path) {
		if (current === null || typeof current !== "object") return undefined;
		current = (current as Record<string, Json>)[key];
	}
	return current;
};

/** Substitute bound keys, in order, into a pattern with the same bindings. */
const fill = (segments: readonly Segment[], bound: readonly string[]) => {
	let next = 0;
	return segments.map((segment) =>
		"literal" in segment ? segment.literal : bound[next++],
	);
};

const sameShape = (pattern: readonly Segment[], path: readonly string[]) =>
	pattern.length === path.length &&
	pattern.every(
		(segment, index) =>
			"binding" in segment || segment.literal === path[index],
	);

function* numbers(
	node: Json,
	path: string[] = [],
): Generator<[path: string[], value: number]> {
	if (typeof node === "number") yield [path, node];
	else if (node !== null && typeof node === "object")
		for (const [key, child] of Object.entries(node))
			yield* numbers(child, [...path, key]);
}

type Raw = {
	/** Where the value and its bounds sit in the record. */
	paths: {
		value: string[];
		lower?: string[];
		upper?: string[];
		status?: string[];
	};
	measure: string;
	members: Record<string, string>;
	release: AreaRelease;
	code: string;
	period: StatisticsPeriod;
	value: number;
	lower?: number;
	upper?: number;
	status?: StatusSlug;
	/** The JSON each status is written as, when a record path holds it. */
	statuses?: Partial<Record<StatusSlug, Json>>;
};

const sourceText = (
	source: unknown,
	key: string,
	type: string,
	required = true,
) => {
	const value =
		typeof source === "object" && source !== null
			? (source as Record<string, unknown>)[key]
			: undefined;
	if (typeof value === "string") return value;
	if (value === undefined && !required) return undefined;
	throw new Error(`${type} manifest source has no ${key}`);
};

/**
 * Statistics rows for a compiled dataset. `read` is called once to plan the
 * series and again to stream observations, so the parsed JSON is never held
 * between the two.
 */
export function declaredStatistics(
	config: DeclaredDataset,
	read: () => string,
	entry: DeclaredManifestEntry,
): (areas: AreaIndex) => StatisticsDataset {
	const type = config.type;
	const nameOf = (from: string) =>
		typeof config.name === "string" ? config.name : config.name?.[from];
	const recordSets: DeclaredRecords[] = config.records ?? [
		{ from: "data", release: config.release, alsoIn: config.alsoIn },
	];
	const derivedPatterns = Object.keys(config.derived ?? {});
	const derived = derivedPatterns.map(parsePath);
	const dimensionSlugs = new Set(
		(config.dimensions ?? []).map((dimension) => dimension.slug),
	);
	const declaredMembers = new Map(
		(config.dimensions ?? [])
			.filter((dimension) => dimension.members)
			.map((dimension) => [
				dimension.slug,
				new Map(
					dimension.members!.map((member) => [
						member.key,
						member.code ?? memberCode(member.key),
					]),
				),
			]),
	);

	const declaredKeys = new Map(
		[...declaredMembers].map(([slug, members]) => [
			slug,
			new Set(members.keys()),
		]),
	);
	const keysFor = (binding: string) => declaredKeys.get(binding);
	const declaredParents = new Map(
		(config.dimensions ?? []).flatMap((dimension) =>
			(dimension.members ?? [])
				.filter((member) => member.parent !== undefined)
				.map((member) => [
					`${dimension.slug}\0${member.key}`,
					member.parent!,
				]),
		),
	);

	/** The text columns of a record's contest and elected candidate. */
	const electionText = (
		record: { [key: string]: Json },
		context: string,
		code: string,
		header: DeclaredHeader,
		recordKey: string,
	) => {
		const read = <Column extends string>(
			paths: Partial<Record<Column, string>> | undefined,
		) => {
			const found: Partial<Record<Column, string | null>> = {};
			let any = false;
			for (const [column, path] of Object.entries(paths ?? {}) as [
				Column,
				string,
			][]) {
				const value = follow(record, path.split("."));
				if (value === undefined) continue;
				if (value !== null && typeof value !== "string")
					throw new Error(
						`${context}: ${path} in ${code} is not text`,
					);
				found[column] = value;
				any = true;
			}
			return any ? found : undefined;
		};
		if (!config.election) return {};
		let contest = read(config.election.contest);
		const { results } = config.election;
		if (results !== undefined) {
			const winners = header[results];
			const winner =
				winners !== null &&
				typeof winners === "object" &&
				!Array.isArray(winners)
					? winners[recordKey]
					: undefined;
			if (winner !== undefined) {
				if (typeof winner !== "string")
					throw new Error(
						`${context}: ${results}.${recordKey} is not a party`,
					);
				contest = { ...contest, winner };
			}
		}
		const elected = read(config.election.elected);
		return {
			...(contest ? { contest } : {}),
			...(elected ? { elected } : {}),
		};
	};
	return (areas) => {
		/**
		 * The listed releases the atlas holds, in order. A year it holds no
		 * release for is skipped, so a dataset can name its true year and
		 * move onto that release once it is added.
		 */
		const held = (releases: DeclaredRelease[], context: string) => {
			const found = releases.flatMap((release) => {
				const match = areas.find(release.geography, release.year);
				return match ? [match] : [];
			});
			if (found.length === 0)
				throw new Error(
					`${context}: the atlas holds none of ${releases.map(({ geography, year }) => `${geography} ${year}`).join(", ")}`,
				);
			return found;
		};
		/** A record set's releases for a part: its own, then its fallbacks. */
		const listed = (set: DeclaredRecords, header: DeclaredHeader) => [
			set.release
				? set.release(header)
				: {
						geography: String(header.boundaryType),
						year: Number(header.boundaryYear),
					},
			...(typeof set.alsoIn === "function"
				? set.alsoIn(header)
				: (set.alsoIn ?? [])),
		];

		/** Every observation in the file, in file order. */
		function* walk(
			onMember?: (
				dimension: string,
				key: string,
				parent?: string,
			) => void,
			onName?: (release: AreaRelease, code: string, name: string) => void,
			onKey?: (release: AreaRelease, code: string, key: string) => void,
			onRelation?: (relation: {
				relation: AreaRelationship;
				period: string;
				child: { release: AreaRelease; code: string };
				parent: { release: AreaRelease; code: string };
			}) => void,
			onElection?: (election: {
				label: string;
				kind: "general" | "local";
				date: string;
				release: AreaRelease;
				contests: {
					release: AreaRelease;
					code: string;
					contest?: Partial<Record<ContestColumn, string | null>>;
					elected?: Partial<Record<CandidacyColumn, string | null>>;
				}[];
			}) => void,
		): Generator<Raw> {
			const file: Record<string, DeclaredHeader> = JSON.parse(read());
			for (const [key, header] of Object.entries(file)) {
				const context = `${type} ${key}`;
				const topPeriod = config.period
					? config.period(key, header)
					: calendarYear(key, context);
				const fields = (
					typeof config.fields === "function"
						? config.fields(key, header)
						: config.fields
				).map((field) => ({
					...field,
					segments: parsePath(field.path),
					lowerSegments:
						field.lower === undefined
							? undefined
							: parsePath(field.lower),
					upperSegments:
						field.upper === undefined
							? undefined
							: parsePath(field.upper),
					statusSegments:
						field.status === undefined
							? undefined
							: parsePath(field.status.path),
				}));
				const areaLists = new Map<
					string,
					StatisticsElection["contests"]
				>();
				for (const set of recordSets) {
					const records = header[set.from];
					if (
						records === null ||
						typeof records !== "object" ||
						Array.isArray(records)
					)
						throw new Error(
							`${context} has no ${set.from} records`,
						);
					const candidates = held(listed(set, header), context);
					const order: StatisticsElection["contests"] = [];
					if (onElection) areaLists.set(set.from, order);
					for (const [recordKey, record] of Object.entries(records)) {
						const code =
							typeof config.keys === "function"
								? config.keys(recordKey, header)
								: (config.keys?.[recordKey] ?? recordKey);
						const release = candidates.find((candidate) =>
							areas.has(candidate, code),
						);
						if (!release) {
							if (
								config.exclude?.some(({ codes }) =>
									codes.test(code),
								)
							)
								continue;
							throw new Error(
								`${context}: area ${code} is in no listed release`,
							);
						}
						if (
							record === null ||
							typeof record !== "object" ||
							Array.isArray(record)
						)
							throw new Error(
								`${context}: record ${code} is not an object`,
							);
						const nameField = nameOf(set.from);
						if (nameField !== undefined && onName) {
							const name = record[nameField];
							if (typeof name !== "string")
								throw new Error(
									`${context}: record ${code} has no ${nameField}`,
								);
							onName(release, code, name);
						}
						const parents = (config.parents ?? []).map((parent) => {
							if (
								!(parent.sets ?? [recordSets[0].from]).includes(
									set.from,
								)
							)
								return undefined;
							const parentCode = follow(
								record,
								parent.code.split("."),
							);
							const parentName =
								parent.name === undefined
									? undefined
									: follow(record, parent.name.split("."));
							if (
								(parentCode === undefined &&
									parentName === undefined) ||
								(parent.nullable &&
									parentCode === null &&
									(parentName ?? null) === null)
							)
								return undefined;
							if (
								typeof parentCode !== "string" ||
								(parent.name !== undefined &&
									typeof parentName !== "string")
							)
								throw new Error(
									`${context}: record ${code} has no ${[parent.code, parent.name].filter(Boolean).join(" and ")}`,
								);
							const parentRelease = held(
								[parent.release, ...(parent.alsoIn ?? [])],
								context,
							).find((candidate) =>
								areas.has(candidate, parentCode),
							);
							if (!parentRelease)
								throw new Error(
									`${context}: ${parent.code} ${parentCode} is in no listed release`,
								);
							if (typeof parentName === "string")
								onName?.(parentRelease, parentCode, parentName);
							return { release: parentRelease, code: parentCode };
						});
						for (const [index, found] of parents.entries())
							if (found)
								onRelation?.({
									relation:
										config.parents![index].relation ??
										"parent",
									period: topPeriod.label,
									child: { release, code },
									parent: found,
								});
						if (recordKey !== code)
							onKey?.(release, code, recordKey);
						if (onElection)
							order.push({
								release,
								code,
								...electionText(
									record,
									context,
									code,
									header,
									recordKey,
								),
							});
						const claimed = new Set<string>();
						for (const field of fields) {
							for (const { node, path, bound } of expand(
								record,
								field.segments,
								keysFor,
							)) {
								claimed.add(path.join("\0"));
								if (node === null) continue;
								if (typeof node !== "number")
									throw new Error(
										`${context}: ${path.join(".")} in ${code} is not a number`,
									);
								const members = { ...field.members };
								let period = field.at ?? topPeriod;
								let parent: Record<string, string> = {};
								let next = 0;
								for (const segment of field.segments) {
									if (!("binding" in segment)) continue;
									const value = bound[next++];
									if (segment.binding === "period") {
										period = field.period
											? field.period(value, header)
											: calendarYear(value, context);
										continue;
									}
									if (!dimensionSlugs.has(segment.binding))
										throw new Error(
											`${type}: ${field.path} binds undeclared dimension ${segment.binding}`,
										);
									const declared = declaredMembers.get(
										segment.binding,
									);
									const memberKey = value;
									if (declared && !declared.has(memberKey))
										throw new Error(
											`${context}: ${memberKey} is not a declared ${segment.binding}`,
										);
									onMember?.(
										segment.binding,
										memberKey,
										parent[segment.binding],
									);
									parent = {
										...parent,
										[segment.binding]: memberKey,
									};
									members[segment.binding] =
										declared?.get(memberKey) ??
										memberCode(memberKey);
								}
								const paths: Raw["paths"] = { value: path };
								const boundValue = (
									segments: readonly Segment[] | undefined,
									which: "lower" | "upper",
								) => {
									if (!segments) return undefined;
									const target = fill(segments, bound);
									claimed.add(target.join("\0"));
									const value = follow(record, target);
									if (value === undefined || value === null)
										return undefined;
									if (typeof value !== "number")
										throw new Error(
											`${context}: ${target.join(".")} in ${code} is not a number`,
										);
									paths[which] = target;
									return value;
								};
								const statusOf = () => {
									if (field.statusOfAll)
										return { status: field.statusOfAll };
									if (!field.status) return {};
									const target = fill(
										field.statusSegments!,
										bound,
									);
									const node = JSON.stringify(
										follow(record, target) ?? null,
									);
									const found = Object.entries(
										field.status.values,
									).find(
										([, value]) =>
											JSON.stringify(value) === node,
									);
									if (!found)
										throw new Error(
											`${context}: ${target.join(".")} in ${code} is ${node}, no listed status`,
										);
									paths.status = target;
									return {
										statuses: field.status.values,
										...(found[0] === "observed"
											? {}
											: {
													status: found[0] as StatusSlug,
												}),
									};
								};
								const raw: Raw = {
									paths,
									measure: field.measure,
									members,
									release,
									code,
									period,
									value: node,
									lower: boundValue(
										field.lowerSegments,
										"lower",
									),
									upper: boundValue(
										field.upperSegments,
										"upper",
									),
									...statusOf(),
								};
								yield raw;
							}
						}
						for (const [path] of numbers(record)) {
							if (claimed.has(path.join("\0"))) continue;
							if (
								derived.some((pattern) =>
									sameShape(pattern, path),
								)
							)
								continue;
							throw new Error(
								`${context}: ${path.join(".")} in ${code} is not mapped or declared derived`,
							);
						}
					}
				}
				for (const link of config.headerRelationships ?? []) {
					const links = header[link.field];
					if (links === null || typeof links !== "object")
						throw new Error(`${context} has no ${link.field}`);
					const [childRelease] = held([link.child], context);
					const [parentRelease] = held([link.parent], context);
					for (const [child, parentKey] of Object.entries(links)) {
						if (typeof parentKey !== "string")
							throw new Error(
								`${context}: ${link.field}.${child} is not a key`,
							);
						const parent =
							typeof config.keys === "function"
								? config.keys(parentKey, header)
								: (config.keys?.[parentKey] ?? parentKey);
						onRelation?.({
							relation: link.relation ?? "parent",
							period: topPeriod.label,
							child: { release: childRelease, code: child },
							parent: { release: parentRelease, code: parent },
						});
					}
				}
				if (onElection && config.election) {
					const first = recordSets[0];
					onElection({
						label: key,
						kind: config.election.kind,
						date: config.election.date(key, header),
						release: held(listed(first, header), context)[0],
						contests: areaLists.get(first.from)!,
					});
				}
			}
		}

		const seriesKey = (raw: Raw) =>
			JSON.stringify([
				raw.measure,
				raw.release.geography,
				raw.release.id,
				Object.entries(raw.members).sort(([a], [b]) =>
					a < b ? -1 : a > b ? 1 : 0,
				),
			]);

		// Plan: series, periods, members and names, in first-seen order.
		const series: StatisticsSeries[] = [];
		const seriesIndex = new Map<string, number>();
		const periodList = new Map<string, StatisticsPeriod>();
		const discovered = new Map<string, Map<string, string | undefined>>();
		const names = new Map<
			string,
			{ release: AreaRelease; code: string; name: string }
		>();
		const keys = new Map<
			string,
			{ release: AreaRelease; code: string; key: string }
		>();
		const elections: StatisticsElection[] = [];
		const related = new Map<
			string,
			{
				relation: AreaRelationship;
				period: string;
				child: { release: AreaRelease; code: string };
				parent: { release: AreaRelease; code: string };
			}
		>();
		const seen = new Set<string>();
		let count = 0;
		for (const raw of walk(
			(dimension, key, parent) => {
				let members = discovered.get(dimension);
				if (!members) {
					members = new Map();
					discovered.set(dimension, members);
				}
				if (!members.has(key)) members.set(key, parent);
				else if (members.get(key) !== parent)
					throw new Error(
						`${type}: ${dimension} ${key} has two parents`,
					);
			},
			(release, code, name) => {
				const key = `${release.id}\0${code}`;
				const known = names.get(key);
				if (!known) names.set(key, { release, code, name });
				else if (known.name !== name)
					throw new Error(
						`${type}: ${code} is named ${known.name} and ${name}`,
					);
			},
			(release, code, key) => {
				const known = keys.get(`${release.id}\0${code}`);
				if (known === undefined)
					keys.set(`${release.id}\0${code}`, { release, code, key });
				else if (known.key !== key)
					throw new Error(
						`${type}: ${code} is keyed ${known.key} and ${key}`,
					);
			},
			(relation) => {
				const key = JSON.stringify([
					relation.relation,
					relation.period,
					relation.child.release.id,
					relation.child.code,
					relation.parent.release.id,
					relation.parent.code,
				]);
				if (!related.has(key)) related.set(key, relation);
			},
			(election) => elections.push(election),
		)) {
			const key = seriesKey(raw);
			let index = seriesIndex.get(key);
			if (index === undefined) {
				index = series.length;
				seriesIndex.set(key, index);
				series.push({
					measure: raw.measure,
					release: raw.release,
					...(Object.keys(raw.members).length
						? { members: raw.members }
						: {}),
				});
			}
			const known = periodList.get(raw.period.label);
			if (!known) periodList.set(raw.period.label, raw.period);
			else if (JSON.stringify(known) !== JSON.stringify(raw.period))
				throw new Error(
					`${type}: period ${raw.period.label} declared twice differently`,
				);
			const cell = `${index}\0${raw.code}\0${raw.period.label}`;
			if (seen.has(cell))
				throw new Error(
					`${type}: two values for ${raw.measure} in ${raw.code} for ${raw.period.label}`,
				);
			seen.add(cell);
			count++;
		}
		seen.clear();

		const dimensions: StatisticsDimension[] = (config.dimensions ?? []).map(
			(dimension) => {
				const found = discovered.get(dimension.slug) ?? new Map();
				const label = new Map(
					(dimension.members ?? []).map((member) => [
						member.key,
						member.label ?? member.key,
					]),
				);
				const keys = dimension.members
					? dimension.members.map((member) => member.key)
					: [...found.keys()];
				const code = (key: string) =>
					declaredMembers.get(dimension.slug)?.get(key) ??
					memberCode(key);
				return {
					slug: dimension.slug,
					label: dimension.label,
					members: keys.map((key) => {
						const parent =
							declaredParents.get(`${dimension.slug}\0${key}`) ??
							found.get(key);
						return {
							code: code(key),
							label: label.get(key) ?? key,
							...(parent === undefined
								? {}
								: { parent: code(parent) }),
						};
					}),
				};
			},
		);

		return {
			slug: entry.output,
			module: config.module,
			title: sourceText(entry.source, "name", type)!,
			description: sourceText(entry.source, "description", type)!,
			source: {
				publisher: sourceText(entry.source, "source", type)!,
				url: sourceText(entry.source, "sourceUrl", type, false),
				licence: sourceText(entry.source, "licence", type)!,
				licenceUrl: sourceText(entry.source, "licenceUrl", type, false),
			},
			fingerprint: entry.fingerprint,
			measures: config.measures,
			dimensions,
			periods: [...periodList.values()],
			series,
			*observations(): Generator<StatisticsObservation> {
				for (const raw of walk())
					yield {
						series: seriesIndex.get(seriesKey(raw))!,
						code: raw.code,
						period: raw.period.label,
						value: raw.value,
						...(raw.lower === undefined
							? {}
							: { lower: raw.lower }),
						...(raw.upper === undefined
							? {}
							: { upper: raw.upper }),
						...(raw.status === undefined
							? {}
							: { status: raw.status }),
					};
			},
			areaNames: () => names.values(),
			areaKeys: () => keys.values(),
			relationships: () => related.values(),
			elections: () => elections,
			...(config.election?.parties
				? { parties: config.election.parties }
				: {}),
			...(config.election?.areas
				? { contestAreas: config.election.areas }
				: {}),
			verify(database: DatabaseSync) {
				const row = database
					.prepare(
						"SELECT count(*) AS n FROM observation o JOIN series s ON s.id = o.series_id WHERE s.key IN (SELECT value FROM json_each(?))",
					)
					.get(
						JSON.stringify(
							series.map((item) =>
								canonicalSeriesKey(entry.output, item),
							),
						),
					);
				if (Number(row?.n) !== count)
					throw new Error(
						`${type}: ${Number(row?.n)} observation rows for ${count} values`,
					);
			},
		};
	};
}
