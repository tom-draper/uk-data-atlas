import type { DatabaseSync } from "node:sqlite";
import { rebuildFromLayout } from "./datasetLayout";
import type {
	AreaIndex,
	AreaRelease,
	StatisticsDataset,
	StatisticsLayout,
	StatisticsLayoutLeaf,
	StatisticsDimension,
	StatisticsMeasure,
	StatisticsObservation,
	StatisticsPeriod,
	StatisticsSeries,
	StatusSlug,
} from "./atlasStatistics";

/**
 * A compiled dataset JSON described as configuration and read into statistics
 * rows. The JSON is `{ [key]: { ...header, data: { [code]: record } } }`, as
 * every catalogue compiler writes it. Each number in a record must be claimed
 * by a field (as a value or an interval bound) or named as derived, so a new
 * field in the compiler output fails the build instead of going missing.
 *
 * The compiled JSON stays the bytes the website and API serve. These rows are
 * the same values, checked by count once written.
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
	/** The period for a `{period}` key. Defaults to the key as a calendar year. */
	period?: (key: string, header: DeclaredHeader) => StatisticsPeriod;
	/** A fixed period for this field, when it differs from the record's. */
	at?: StatisticsPeriod;
	status?: (record: { [key: string]: Json }) => StatusSlug | undefined;
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
	alsoIn?: DeclaredRelease[];
};

export type DeclaredDataset = {
	/** The manifest `type` this describes. */
	type: string;
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
	alsoIn?: DeclaredRelease[];
	/** Shorthand for `release` on the default record set. */
	release?: (header: DeclaredHeader) => DeclaredRelease;
	/** Codes in no listed release that are left out, with why. */
	exclude?: { codes: RegExp; reason: string }[];
	/** Record field holding the publisher's area name. */
	name?: string;
	/**
	 * Record fields naming an area each record lies in, by code and name, with
	 * the release the codes are on. Stored for datasets served from rows.
	 */
	parents?: DeclaredParent[];
	/**
	 * Serve the compiled JSON from rows instead of a stored payload. The build
	 * refuses a dataset whose rows do not rebuild it byte for byte. Each
	 * `derived` pattern needs a rule here, computed from the rebuilt record
	 * in the order listed, exactly as its compiler computes it.
	 */
	rebuild?: { derived?: Record<string, DerivedRule> };
};

type LaidOutArea = StatisticsLayout["records"][number]["areas"][number];

export type DeclaredParent = {
	code: string;
	name: string;
	release: DeclaredRelease;
	/** Releases tried, in order, for codes not in the first. */
	alsoIn?: DeclaredRelease[];
};

/** A derived number, from the record with every stored value filled in. */
export type DerivedRule = (record: { [key: string]: Json }) => number;

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
	paths: { value: string[]; lower?: string[]; upper?: string[] };
	measure: string;
	members: Record<string, string>;
	release: AreaRelease;
	code: string;
	period: StatisticsPeriod;
	value: number;
	lower?: number;
	upper?: number;
	status?: StatusSlug;
};

/**
 * Every record of one record set, reduced to what its layout needs: the leaf
 * paths in a key order all records agree with, a sample of each leaf (the
 * first non-null), the first value claimed at each path, and each record's
 * set of leaves, so leaves a record lacks are known.
 */
class RecordSample {
	readonly order: string[] = [];
	readonly paths = new Map<string, string[]>();
	readonly nodes = new Map<string, { node: Json; code: string }>();
	readonly claims = new Map<
		string,
		{ kind: "value" | "lower" | "upper"; raw: Raw }
	>();
	readonly shapes = new Map<string, Set<string>>();
	/** Each record's shape, in the file's order. */
	readonly recordShapes: string[] = [];

	constructor(private readonly context: string) {}

	add(code: string, record: { [key: string]: Json }) {
		const present: string[] = [];
		const visit = (node: Json, path: string[]) => {
			if (
				node !== null &&
				typeof node === "object" &&
				!Array.isArray(node) &&
				Object.keys(node).length > 0
			) {
				for (const [child, value] of Object.entries(node))
					visit(value, [...path, child]);
				return;
			}
			const key = path.join("\0");
			present.push(key);
			if (!this.paths.has(key)) this.paths.set(key, path);
			const known = this.nodes.get(key);
			if (!known || (known.node === null && node !== null))
				this.nodes.set(key, { node, code });
		};
		visit(record, []);
		const shape = present.join("\u0001");
		this.recordShapes.push(shape);
		if (this.shapes.has(shape)) return;
		this.shapes.set(shape, new Set(present));
		let last = -1;
		for (const key of present) {
			let index = this.order.indexOf(key);
			if (index === -1) this.order.splice((index = last + 1), 0, key);
			else if (index <= last)
				throw new Error(
					`${this.context}: ${code} orders ${key.replaceAll("\0", ".")} differently from earlier records`,
				);
			last = index;
		}
	}

	claim(raw: Raw) {
		for (const kind of ["value", "lower", "upper"] as const) {
			const path = raw.paths[kind];
			if (!path) continue;
			const key = path.join("\0");
			if (!this.claims.has(key)) this.claims.set(key, { kind, raw });
		}
	}

	/** Leaf positions a shape lacks. */
	absent(shape: string) {
		const present = this.shapes.get(shape)!;
		return this.order.flatMap((key, index) =>
			present.has(key) ? [] : [index],
		);
	}
}

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

	return (areas) => {
		const releaseOf = (release: DeclaredRelease) =>
			areas.release(release.geography, release.year);

		/** Every observation in the file, in file order. */
		function* walk(
			onMember?: (
				dimension: string,
				key: string,
				parent?: string,
			) => void,
			onName?: (release: AreaRelease, code: string, name: string) => void,
			onPart?: (part: {
				key: string;
				header: DeclaredHeader;
				/** Each record set's records, reduced for laying out. */
				samples: Map<string, RecordSample>;
				/** Each record set's areas, in the file's order. */
				areas: Map<string, LaidOutArea[]>;
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
				}));
				const samples = new Map<string, RecordSample>();
				const areaLists = new Map<string, LaidOutArea[]>();
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
					const primary = set.release
						? set.release(header)
						: {
								geography: String(header.boundaryType),
								year: Number(header.boundaryYear),
							};
					const candidates = [primary, ...(set.alsoIn ?? [])].map(
						releaseOf,
					);
					const order: LaidOutArea[] = [];
					if (onPart) areaLists.set(set.from, order);
					for (const [code, record] of Object.entries(records)) {
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
						if (config.name !== undefined && onName) {
							const name = record[config.name];
							if (typeof name !== "string")
								throw new Error(
									`${context}: record ${code} has no ${config.name}`,
								);
							onName(release, code, name);
						}
						const parents = (config.parents ?? []).map((parent) => {
							const parentCode = record[parent.code];
							const parentName = record[parent.name];
							if (
								parentCode === undefined &&
								parentName === undefined
							)
								return undefined;
							if (
								typeof parentCode !== "string" ||
								typeof parentName !== "string"
							)
								throw new Error(
									`${context}: record ${code} has no ${parent.code} and ${parent.name}`,
								);
							const parentRelease = [
								parent.release,
								...(parent.alsoIn ?? []),
							]
								.map(releaseOf)
								.find((candidate) =>
									areas.has(candidate, parentCode),
								);
							if (!parentRelease)
								throw new Error(
									`${context}: ${parent.code} ${parentCode} is in no listed release`,
								);
							onName?.(parentRelease, parentCode, parentName);
							return { release: parentRelease, code: parentCode };
						});
						if (onPart) order.push({ release, code, parents });
						let sample: RecordSample | undefined;
						if (onPart) {
							sample = samples.get(set.from);
							if (!sample)
								samples.set(
									set.from,
									(sample = new RecordSample(context)),
								);
							sample.add(code, record);
						}
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
									status: field.status?.(record),
								};
								sample?.claim(raw);
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
				onPart?.({ key, header, samples, areas: areaLists });
			}
		}

		const parentFields = new Map<
			string,
			{ kind: "parent_code" | "parent_name"; parent: number }
		>(
			(config.parents ?? []).flatMap(({ code, name }, parent) => [
				[code, { kind: "parent_code", parent }],
				[name, { kind: "parent_name", parent }],
			]),
		);

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
		const seen = new Set<string>();
		let count = 0;
		const layouts: StatisticsLayout[] = [];
		const layOut: Parameters<typeof walk>[2] = ({
			key,
			header,
			samples,
			areas: orders,
		}) => {
			const context = `${type} ${key}`;
			const sets = new Set(recordSets.map((set) => set.from));
			const records = recordSets.map(({ from }) => {
				const sample = samples.get(from);
				if (!sample)
					throw new Error(
						`${context}: no ${from} records to lay out`,
					);
				const leaves = sample.order.map(
					(leafKey): StatisticsLayoutLeaf => {
						const path = sample.paths.get(leafKey)!;
						const claim = sample.claims.get(leafKey);
						if (claim)
							return {
								path,
								kind: claim.kind,
								series: seriesIndex.get(seriesKey(claim.raw))!,
								period: claim.raw.period.label,
							};
						const { node, code } = sample.nodes.get(leafKey)!;
						if (
							path.length === 1 &&
							path[0] === config.name &&
							typeof node === "string"
						)
							return { path, kind: "name" };
						const parent =
							path.length === 1
								? parentFields.get(path[0])
								: undefined;
						if (parent && typeof node === "string")
							return { path, ...parent };
						if (node === code) return { path, kind: "code" };
						if (typeof node === "number") {
							const index = derived.findIndex((pattern) =>
								sameShape(pattern, path),
							);
							const rule = derivedPatterns[index];
							if (!config.rebuild?.derived?.[rule])
								throw new Error(
									`${type}: derived ${rule} has no rebuild rule`,
								);
							return { path, kind: "derived", rule };
						}
						return {
							path,
							kind: "literal",
							value: JSON.stringify(node),
						};
					},
				);
				const absent = new Map<string, number[]>();
				const areas = orders.get(from)!.map((area, index) => {
					const shape = sample.recordShapes[index];
					let lacking = absent.get(shape);
					if (!lacking)
						absent.set(shape, (lacking = sample.absent(shape)));
					return lacking.length ? { ...area, absent: lacking } : area;
				});
				return { from, leaves, areas };
			});
			layouts.push({
				key,
				header: JSON.stringify(
					Object.fromEntries(
						Object.entries(header).map(([field, value]) => [
							field,
							sets.has(field) ? null : value,
						]),
					),
				),
				records,
			});
		};
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
			config.rebuild ? layOut : undefined,
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
			layouts: () => layouts,
			verify(database: DatabaseSync) {
				const row = database
					.prepare(
						"SELECT count(*) AS n FROM observation o JOIN series s ON s.id = o.series_id JOIN dataset d ON d.id = s.dataset_id WHERE d.slug = ?",
					)
					.get(entry.output);
				if (Number(row?.n) !== count)
					throw new Error(
						`${type}: ${Number(row?.n)} observation rows for ${count} values`,
					);
				if (config.rebuild) {
					const rebuilt = rebuildFromLayout(
						database,
						entry.output,
						config.rebuild.derived,
					);
					const text = read();
					if (rebuilt !== text) {
						let at = 0;
						while (rebuilt[at] === text[at]) at++;
						const near = (value: string) =>
							JSON.stringify(
								value.slice(Math.max(0, at - 60), at + 60),
							);
						throw new Error(
							`${type}: rows do not rebuild the compiled JSON byte for byte. At ${at}, compiled ${near(text)}, rebuilt ${near(rebuilt)}`,
						);
					}
				}
			},
		};
	};
}
