import type { DatabaseSync } from "node:sqlite";
import {
	memberCode,
	type DeclaredDataset,
	type DeclaredField,
	type DeclaredHeader,
	type DeclaredPayload,
	type DerivedContext,
	type Json,
} from "./declaredStatistics";

/**
 * A dataset's JSON, generated from its statistics rows and declaration alone.
 * The declaration's field paths say where each series' values sit in a record;
 * `payload` adds what rows cannot say: each part's header, the record field
 * holding the area code, and which containers are arrays.
 */

type Placeholder = { binding: string } | { literal: string };

const parse = (path: string): Placeholder[] =>
	path.split(".").map((part) => {
		const match = /^\{([a-z0-9-]+)\}$/.exec(part);
		return match ? { binding: match[1] } : { literal: part };
	});

const fill = (segments: readonly Placeholder[], bound: Map<string, string>) =>
	segments.map((segment) => {
		if ("literal" in segment) return segment.literal;
		const value = bound.get(segment.binding);
		if (value === undefined)
			throw new Error(`${segment.binding} is not bound`);
		return value;
	});

const bindings = (segments: readonly Placeholder[]) =>
	segments.flatMap((segment) =>
		"binding" in segment ? [segment.binding] : [],
	);

type Node = Record<string, Json> | Json[];

const place = (
	record: Node,
	path: readonly string[],
	value: Json,
	arrays: ReadonlySet<string>,
) => {
	let node = record as Record<string, Json>;
	for (const [index, key] of path.slice(0, -1).entries()) {
		let child = node[key];
		if (child === undefined) {
			child = arrays.has(path.slice(0, index + 1).join(".")) ? [] : {};
			node[key] = child;
		}
		if (child === null || typeof child !== "object")
			throw new Error(`${path.join(".")} crosses a value`);
		node = child as Record<string, Json>;
	}
	node[path[path.length - 1]] = value;
};

type Observation = {
	code: string;
	name: string;
	period: string;
	value: number | null;
	lower: number | null;
	upper: number | null;
	status: string;
};

type Series = {
	id: number;
	measure: string;
	members: Map<string, { code: string; label: string }>;
};

/**
 * Parts keyed by the given years, or the calendar years period labels start
 * with, with the standard header fields.
 */
export const yearParts =
	(
		type: string,
		boundaryType: string,
		boundaryYear: number,
		extra: DeclaredHeader = {},
		keys?: string[],
	): DeclaredPayload["parts"] =>
	(labels) =>
		(
			keys ?? [
				...new Set(
					labels
						.filter((label) => /^\d{4}(?!\d)/.test(label))
						.map((label) => label.slice(0, 4)),
				),
			]
		)
			.sort()
			.map((key) => ({
				key,
				header: {
					id: `${type}${key}`,
					type,
					year: Number(key),
					boundaryType,
					boundaryYear,
					...extra,
				},
			}));

export function rebuildFromDeclaration(
	database: DatabaseSync,
	config: DeclaredDataset,
	slug: string,
	/** Another dataset's JSON, for derived rules that read one. */
	readDataset: DerivedContext["dataset"] = (other) => {
		throw new Error(`${slug} reads ${other}`);
	},
): string {
	const spec = config.payload;
	if (!spec) throw new Error(`${slug} declares no payload`);
	if ((config.records?.length ?? 1) !== 1)
		throw new Error(`${slug}: several record sets are not generated`);
	const arrays = new Set(spec.arrays ?? []);
	const dataset = database
		.prepare("SELECT id FROM dataset WHERE slug = ?")
		.get(slug)?.id;
	if (typeof dataset !== "number") throw new Error(`Unknown dataset ${slug}`);

	// code -> key for each dimension: declared keys, else the stored label.
	const keyOf = new Map<string, Map<string, string>>();
	for (const dimension of config.dimensions ?? [])
		if (dimension.members)
			keyOf.set(
				dimension.slug,
				new Map(
					dimension.members.map((member) => [
						member.code ?? memberCode(member.key),
						member.key,
					]),
				),
			);

	const series: Series[] = [];
	const seriesQuery = database.prepare(
		`SELECT s.id, m.slug AS measure FROM series s JOIN measure m ON m.id = s.measure_id WHERE s.dataset_id = ? ORDER BY s.id`,
	);
	const memberQuery = database.prepare(
		`SELECT d.slug AS dimension, dm.code, dm.label
		FROM series_member sm JOIN dimension d ON d.id = sm.dimension_id
		JOIN dimension_member dm ON dm.id = sm.member_id WHERE sm.series_id = ?`,
	);
	for (const row of seriesQuery.all(dataset)) {
		const members = new Map<string, { code: string; label: string }>();
		for (const member of memberQuery.all(Number(row.id)))
			members.set(String(member.dimension), {
				code: String(member.code),
				label: String(member.label),
			});
		series.push({
			id: Number(row.id),
			measure: String(row.measure),
			members,
		});
	}

	const observed = new Map<number, Observation[]>();
	for (const row of database
		.prepare(
			`SELECT o.series_id AS series, a.code, coalesce(k.key, a.code) AS key,
				coalesce(n.name, v.name) AS name, p.label AS period,
				o.value, o.lower, o.upper, st.slug AS status
			FROM series s
			JOIN observation o ON o.series_id = s.id
			JOIN area_version v ON v.id = o.area_version_id
			JOIN area a ON a.id = v.area_id
			JOIN period p ON p.id = o.period_id
			JOIN status st ON st.id = o.status_id
			LEFT JOIN dataset_area_name n ON n.dataset_id = s.dataset_id AND n.area_version_id = v.id
			LEFT JOIN dataset_area_key k ON k.dataset_id = s.dataset_id AND k.area_version_id = v.id
			WHERE s.dataset_id = ? ORDER BY a.code`,
		)
		.all(dataset)) {
		const list = observed.get(Number(row.series)) ?? [];
		observed.set(Number(row.series), list);
		list.push({
			code: String(row.key),
			name: String(row.name),
			period: String(row.period),
			value: row.value as number | null,
			lower: row.lower as number | null,
			upper: row.upper as number | null,
			status: String(row.status),
		});
	}
	const labels = [
		...new Set([...observed.values()].flat().map((row) => row.period)),
	];
	const result: Record<string, Json> = {};
	for (const { key, header } of spec.parts(labels)) {
		const context = `${slug} ${key}`;
		const full = { ...header, data: null } as DeclaredHeader;
		const top = config.period
			? config.period(key, full).label
			: /^\d{4}$/.test(key)
				? key
				: (() => {
						throw new Error(`${context}: key is not a year`);
					})();
		const fields: DeclaredField[] =
			typeof config.fields === "function"
				? config.fields(key, full)
				: config.fields;
		const records = new Map<string, Record<string, Json>>();
		const record = (code: string, name: string) => {
			let found = records.get(code);
			if (!found) {
				found = {};
				records.set(code, found);
				if (config.name !== undefined) found[config.name] = name;
				if (spec.code !== undefined) found[spec.code] = code;
			}
			return found;
		};
		const matching = (field: DeclaredField, one: Series) => {
			const fixed = Object.keys(field.members ?? {});
			const wanted = bindings(parse(field.path)).filter(
				(name) => name !== "period",
			);
			return (
				one.measure === field.measure &&
				one.members.size === fixed.length + wanted.length &&
				fixed.every(
					(slug) =>
						one.members.get(slug)?.code === field.members![slug],
				) &&
				wanted.every((slug) => one.members.has(slug))
			);
		};
		/** A series goes to the matching field that fixes the most members. */
		const owner = new Map<number, DeclaredField>();
		for (const one of series)
			for (const field of fields) {
				if (!matching(field, one)) continue;
				const held = owner.get(one.id);
				if (
					!held ||
					Object.keys(field.members ?? {}).length >
						Object.keys(held.members ?? {}).length
				)
					owner.set(one.id, field);
			}
		const nulls: string[][] = [];
		for (const field of fields) {
			const segments_ = parse(field.path);
			const segments = segments_;
			const names = bindings(segments);
			const wanted = names.filter((name) => name !== "period");
			const periodBound = names.includes("period");
			const lower = field.lower ? parse(field.lower) : undefined;
			const upper = field.upper ? parse(field.upper) : undefined;
			const status = field.status ? parse(field.status.path) : undefined;
			const tuples = new Map<string, Map<string, string>>();
			for (const one of series) {
				if (owner.get(one.id) !== field) continue;
				const bound = new Map<string, string>();
				for (const name of wanted) {
					const member = one.members.get(name)!;
					bound.set(
						name,
						keyOf.get(name)?.get(member.code) ?? member.label,
					);
				}
				for (const row of observed.get(one.id) ?? []) {
					const own = new Map(bound);
					let period = field.at?.label ?? top;
					if (periodBound) {
						const periodKey = row.period;
						if (
							field.period &&
							field.period(periodKey, full).label !== row.period
						)
							throw new Error(
								`${context}: period ${row.period} has no key`,
							);
						own.set("period", periodKey);
						period = row.period;
					}
					if (row.period !== period) continue;
					const target = record(row.code, row.name);
					const tuple = JSON.stringify([...own]);
					tuples.set(tuple, own);
					place(target, fill(segments, own), row.value, arrays);
					if (lower)
						place(target, fill(lower, own), row.lower, arrays);
					if (upper)
						place(target, fill(upper, own), row.upper, arrays);
					if (status) {
						const json =
							field.status!.values[row.status as "observed"];
						if (json === undefined)
							throw new Error(
								`${context}: status ${row.status} has no JSON`,
							);
						place(target, fill(status, own), json, arrays);
					}
				}
			}
			if (
				spec.omitMissing?.some((prefix) =>
					field.path.startsWith(prefix),
				)
			)
				continue;
			for (const own of tuples.values())
				for (const segments of [segments_, lower, upper, status])
					if (segments) nulls.push(fill(segments, own));
		}
		// A value with no observation is null.
		for (const path of nulls)
			for (const target of records.values())
				if (!has(target, path)) place(target, path, null, arrays);
		// Derived numbers, from each record's stored values, in rule order.
		for (const [rule, compute] of Object.entries(
			config.rebuild?.derived ?? {},
		)) {
			const segments = parse(rule);
			for (const [code, target] of records)
				for (const path of expand(target, segments)) {
					const value = compute(target, path, {
						code,
						header: full,
						dataset: readDataset,
					});
					if (value !== undefined) place(target, path, value, arrays);
				}
		}
		if (records.size === 0) continue;
		result[key] = {
			...header,
			data: Object.fromEntries(records),
		} as Json;
	}
	if (Object.keys(result).length === 0)
		throw new Error(`${slug} has no rows`);
	return JSON.stringify(result);
}

/** The paths a pattern reaches: a binding takes each key already there. */
function expand(
	node: Json,
	segments: readonly Placeholder[],
	path: string[] = [],
): string[][] {
	if (path.length === segments.length) return [path];
	const segment = segments[path.length];
	if ("literal" in segment)
		return expand(node, segments, [...path, segment.literal]);
	if (node === null || typeof node !== "object") return [];
	return Object.keys(node).flatMap((key) =>
		expand((node as Record<string, Json>)[key], segments, [...path, key]),
	);
}

const has = (node: Json, path: readonly string[]) => {
	let current: Json | undefined = node;
	for (const key of path) {
		if (current === null || typeof current !== "object") return false;
		current = (current as Record<string, Json>)[key];
		if (current === undefined) return false;
	}
	return true;
};
