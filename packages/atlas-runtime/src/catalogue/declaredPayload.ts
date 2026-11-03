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

/**
 * A dimension named twice in a path binds its parent member first and the
 * member second; the later binding of a name is keyed `name#1`, and so on.
 */
const bindingKey = (name: string, occurrence: number) =>
	occurrence === 0 ? name : `${name}#${occurrence}`;

const fill = (segments: readonly Placeholder[], bound: Map<string, string>) => {
	const seen = new Map<string, number>();
	return segments.map((segment) => {
		if ("literal" in segment) return segment.literal;
		const occurrence = seen.get(segment.binding) ?? 0;
		seen.set(segment.binding, occurrence + 1);
		const value = bound.get(bindingKey(segment.binding, occurrence));
		if (value === undefined)
			throw new Error(`${segment.binding} is not bound`);
		return value;
	});
};

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
	members: Map<string, { code: string; label: string; parent?: string }>;
	geography: string;
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
	const arrays = new Set(spec.arrays ?? []);
	const dataset = database
		.prepare("SELECT id FROM dataset WHERE slug = ?")
		.get(slug)?.id;
	if (typeof dataset !== "number") throw new Error(`Unknown dataset ${slug}`);

	// The areas a publisher relates each record to, by record key.
	type Related = { code: string; name: string; geography: string };
	const relatedByPeriod = new Map<
		string,
		{
			related: Map<string, Map<string, Related[]>>;
			names: Map<string, string>;
		}
	>();
	if (config.parents?.length)
		for (const row of database
			.prepare(
				`SELECT r.relation, p.label AS period, coalesce(k.key, ca.code) AS child, coalesce(cn.name, cv.name) AS child_name, pa.code AS code,
					coalesce(n.name, pv.name) AS name, pr.geography AS geography
				FROM area_relationship r
				JOIN period p ON p.id = r.period_id
				JOIN area_version cv ON cv.id = r.child_version_id
				JOIN area ca ON ca.id = cv.area_id
				LEFT JOIN dataset_area_key k ON k.dataset_id = r.dataset_id AND k.area_version_id = cv.id
				JOIN area_version pv ON pv.id = r.parent_version_id
				JOIN area pa ON pa.id = pv.area_id
				JOIN area_releases pr ON pr.position = pv.release_id
				LEFT JOIN dataset_area_name n ON n.dataset_id = r.dataset_id AND n.area_version_id = pv.id
				LEFT JOIN dataset_area_name cn ON cn.dataset_id = r.dataset_id AND cn.area_version_id = cv.id
				WHERE r.dataset_id = ? ORDER BY pa.code`,
			)
			.all(dataset)) {
			let period = relatedByPeriod.get(String(row.period));
			if (!period)
				relatedByPeriod.set(
					String(row.period),
					(period = { related: new Map(), names: new Map() }),
				);
			period.names.set(String(row.child), String(row.child_name));
			const byRelation =
				period.related.get(String(row.child)) ?? new Map();
			period.related.set(String(row.child), byRelation);
			const list = byRelation.get(String(row.relation)) ?? [];
			byRelation.set(String(row.relation), list);
			list.push({
				code: String(row.code),
				name: String(row.name),
				geography: String(row.geography),
			});
		}

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
		`SELECT s.id, m.slug AS measure, r.geography FROM series s JOIN measure m ON m.id = s.measure_id JOIN area_releases r ON r.position = s.release_id WHERE s.dataset_id = ? ORDER BY s.id`,
	);
	const memberQuery = database.prepare(
		`SELECT d.slug AS dimension, dm.code, dm.label, pm.label AS parent
		FROM series_member sm JOIN dimension d ON d.id = sm.dimension_id
		JOIN dimension_member dm ON dm.id = sm.member_id
		LEFT JOIN dimension_member pm ON pm.id = dm.parent_id WHERE sm.series_id = ?`,
	);
	for (const row of seriesQuery.all(dataset)) {
		const members = new Map<
			string,
			{ code: string; label: string; parent?: string }
		>();
		for (const member of memberQuery.all(Number(row.id)))
			members.set(String(member.dimension), {
				code: String(member.code),
				label: String(member.label),
				...(member.parent === null
					? {}
					: { parent: String(member.parent) }),
			});
		series.push({
			id: Number(row.id),
			measure: String(row.measure),
			members,
			geography: String(row.geography),
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
	for (const { key, header, optional } of spec.parts(labels)) {
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
		const related =
			relatedByPeriod.get(top)?.related ??
			new Map<string, Map<string, Related[]>>();
		const relatedNames =
			relatedByPeriod.get(top)?.names ?? new Map<string, string>();
		const sets = config.records ?? [{ from: "data" }];
		const sections: Record<string, Json> = {};
		/** The party the publisher declares won each contest, by record key. */
		const winners: Record<string, Json> = {};
		for (const [setIndex, set] of sets.entries()) {
			/** The geographies a record set's areas are on, when there are several sets. */
			const setGeographies = (() => {
				if (sets.length === 1) return undefined;
				const also =
					set.alsoIn ?? (setIndex === 0 ? config.alsoIn : undefined);
				return new Set<string>([
					set.release
						? set.release(full).geography
						: String(full.boundaryType),
					...(typeof also === "function"
						? also(full)
						: (also ?? [])
					).map((release) => release.geography),
				]);
			})();
			const codeField =
				typeof spec.code === "string"
					? spec.code
					: spec.code?.[set.from];
			const records = new Map<string, Record<string, Json>>();
			const record = (code: string, name: string) => {
				let found = records.get(code);
				if (!found) {
					found = {};
					records.set(code, found);
					const nameField =
						typeof config.name === "string"
							? config.name
							: config.name?.[set.from];
					if (nameField !== undefined) found[nameField] = name;
					if (codeField !== undefined) found[codeField] = code;
				}
				return found;
			};
			const matching = (field: DeclaredField, one: Series) => {
				const fixed = Object.keys(field.members ?? {});
				const wanted = [
					...new Set(
						bindings(parse(field.path)).filter(
							(name) => name !== "period",
						),
					),
				];
				return (
					one.measure === field.measure &&
					(!setGeographies || setGeographies.has(one.geography)) &&
					one.members.size === fixed.length + wanted.length &&
					fixed.every(
						(slug) =>
							one.members.get(slug)?.code ===
							field.members![slug],
					) &&
					wanted.every((slug) => one.members.has(slug))
				);
			};
			/** A series goes to the one field that fits it, or fits it and `wins`. */
			const owner = new Map<number, DeclaredField>();
			for (const one of series) {
				const fitting = fields.filter((field) => matching(field, one));
				if (fitting.length === 0) continue;
				const winners =
					fitting.length === 1
						? fitting
						: fitting.filter((field) => field.wins);
				if (winners.length !== 1)
					throw new Error(
						`${context}: series ${one.measure} fits ${fitting.map((field) => field.path).join(", ")}; mark exactly one \`wins\``,
					);
				owner.set(one.id, winners[0]);
			}
			const nulls: {
				path: string[];
				period?: string;
				parent?: boolean;
			}[] = [];
			const periodic: {
				segments: Placeholder[];
				dimensions: Map<string, string>;
			}[] = [];
			/** The period keys each record has an observation in. */
			const observedIn = new Map<string, Set<string>>();
			for (const field of fields) {
				const segments_ = parse(field.path);
				const segments = segments_;
				const names = bindings(segments);
				const wanted = [
					...new Set(names.filter((name) => name !== "period")),
				];
				const periodBound = names.includes("period");
				const lower = field.lower ? parse(field.lower) : undefined;
				const upper = field.upper ? parse(field.upper) : undefined;
				const status = field.status
					? parse(field.status.path)
					: undefined;
				const tuples = new Map<string, Map<string, string>>();
				for (const one of series) {
					if (owner.get(one.id) !== field) continue;
					const bound = new Map<string, string>();
					for (const name of wanted) {
						const member = one.members.get(name)!;
						const own =
							keyOf.get(name)?.get(member.code) ?? member.label;
						// Named twice, the first binding is the member's parent.
						const times = names.filter(
							(each) => each === name,
						).length;
						if (times > 2)
							throw new Error(
								`${context}: ${name} is nested too deep`,
							);
						if (times === 2) {
							if (member.parent === undefined)
								throw new Error(
									`${context}: ${member.label} has no parent for ${field.path}`,
								);
							bound.set(name, member.parent);
							bound.set(bindingKey(name, 1), own);
						} else bound.set(name, own);
					}
					tuples.set(JSON.stringify([...bound]), new Map(bound));
					for (const row of observed.get(one.id) ?? []) {
						const own = new Map(bound);
						let period = field.at?.label ?? top;
						if (periodBound) {
							let periodKey = row.period;
							if (field.period) {
								const found = (spec.periodKeys ?? []).find(
									(candidate) =>
										field.period!(candidate, full).label ===
										row.period,
								);
								if (found === undefined)
									throw new Error(
										`${context}: period ${row.period} has no key`,
									);
								periodKey = found;
							}
							own.set("period", periodKey);
							period = row.period;
						}
						if (row.period !== period) continue;
						const target = record(row.code, row.name);
						if (periodBound) {
							let known = observedIn.get(row.code);
							if (!known)
								observedIn.set(row.code, (known = new Set()));
							known.add(own.get("period")!);
						}
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
				for (const own of tuples.values()) {
					const dimensions = new Map(own);
					dimensions.delete("period");
					for (const segments of [segments_, lower, upper, status])
						if (segments) periodic.push({ segments, dimensions });
				}
			}
			// Every period a record has a value in gives each period-bound field a place.
			const everyPeriod = new Set(
				[...observedIn.values()].flatMap((set) => [...set]),
			);
			for (const { segments, dimensions } of periodic)
				if (bindings(segments).includes("period"))
					for (const period of everyPeriod)
						nulls.push({
							path: fill(
								segments,
								new Map(dimensions).set("period", period),
							),
							period,
						});
				else nulls.push({ path: fill(segments, dimensions) });
			for (const path of spec.nullPaths ?? [])
				nulls.push({ path: path.split("."), parent: true });
			// A value with no observation is null.
			for (const { path, period, parent } of nulls)
				for (const [code, target] of records)
					if (
						!has(target, path) &&
						(!parent || has(target, path.slice(0, -1))) &&
						(period === undefined ||
							!spec.sparsePeriods ||
							observedIn.get(code)?.has(period))
					)
						place(target, path, null, arrays);
			if (config.election && setIndex === 0) {
				const wanted = config.election;
				for (const row of database
					.prepare(
						`SELECT coalesce(k.key, a.code) AS code, c.*,
						d.given_name AS candidacy_given_name, d.family_name AS candidacy_family_name, d.gender AS candidacy_gender
					FROM election e
					JOIN contest c ON c.election_id = e.id
					JOIN area_version v ON v.id = c.area_version_id
					JOIN area a ON a.id = v.area_id
					LEFT JOIN dataset_area_key k ON k.dataset_id = e.dataset_id AND k.area_version_id = v.id
					LEFT JOIN candidacy d ON d.contest_id = c.id AND d.elected = 1
					WHERE e.dataset_id = ? AND e.date = ?`,
					)
					.all(dataset, wanted.date(key, full))) {
					const target = records.get(String(row.code));
					if (!target) continue;
					for (const [column, path] of Object.entries(
						wanted.contest ?? {},
					))
						place(
							target,
							path.split("."),
							(row[column] as string | null) ?? null,
							arrays,
						);
					for (const [column, path] of Object.entries(
						wanted.elected ?? {},
					))
						place(
							target,
							path.split("."),
							(row[`candidacy_${column}`] as string | null) ??
								null,
							arrays,
						);
					if (row.winner !== null)
						winners[String(row.code)] = String(row.winner);
				}
			}
			if (spec.relatedRecords)
				for (const [code, name] of relatedNames) record(code, name);
			for (const path of spec.emptyObjects ?? [])
				for (const target of records.values())
					if (!has(target, path.split(".")))
						place(target, path.split("."), {}, arrays);
			for (const path of spec.emptyArrays ?? [])
				for (const target of records.values())
					if (!has(target, path.split(".")))
						place(target, path.split("."), [], arrays);
			// Related areas: a record's n-th parent field of a kind takes its n-th area.
			const kinds = new Map<string, number>();
			const geographies = (
				parent: NonNullable<typeof config.parents>[number],
			) =>
				new Set([
					parent.release.geography,
					...(parent.alsoIn ?? []).map(
						(release) => release.geography,
					),
				]);
			for (const [code, target] of records) {
				kinds.clear();
				for (const parent of config.parents ?? []) {
					if (!(parent.sets ?? [sets[0].from]).includes(set.from))
						continue;
					const relation = parent.relation ?? "parent";
					const geos = geographies(parent);
					const kind = `${relation}\0${[...geos].join(",")}`;
					const taken = kinds.get(kind) ?? 0;
					kinds.set(kind, taken + 1);
					const found = related
						.get(code)
						?.get(relation)
						?.filter((area) => geos.has(area.geography))[taken];
					if (!found) {
						if (parent.nullable) {
							place(target, parent.code.split("."), null, arrays);
							if (parent.name !== undefined)
								place(
									target,
									parent.name.split("."),
									null,
									arrays,
								);
						}
						continue;
					}
					place(target, parent.code.split("."), found.code, arrays);
					if (parent.name !== undefined)
						place(
							target,
							parent.name.split("."),
							found.name,
							arrays,
						);
				}
			}
			if (spec.fill)
				for (const [code, target] of records)
					spec.fill(target, code, sections);
			if (spec.without)
				for (const [code, target] of records)
					for (const path of spec.without(
						new Set(related.get(code)?.keys() ?? []),
					)) {
						const keys = path.split(".");
						const parent = keys
							.slice(0, -1)
							.reduce<Json | undefined>(
								(node, key) =>
									node !== null && typeof node === "object"
										? (node as Record<string, Json>)[key]
										: undefined,
								target,
							);
						if (parent !== null && typeof parent === "object")
							delete (parent as Record<string, Json>)[
								keys[keys.length - 1]
							];
					}
			// Derived numbers, from each record's stored values, in rule order.
			for (const [rule, compute] of Object.entries(
				config.rebuild?.derived ?? {},
			)) {
				const segments = parse(rule);
				for (const [code, target] of records)
					for (const path of expand(target, segments)) {
						// A number the record's fields already hold is not derived.
						if (has(target, path)) continue;
						const value = compute(target, path, {
							code,
							header: full,
							dataset: readDataset,
						});
						if (value !== undefined)
							place(target, path, value, arrays);
					}
			}
			sections[set.from] = Object.fromEntries(records);
		}
		const data = sections[sets[0].from] as Record<string, Json>;
		if (Object.keys(data).length === 0) {
			if (optional) continue;
			throw new Error(
				`${context}: no records; declare the part optional`,
			);
		}
		const linked: Record<string, Json> = {};
		for (const link of config.headerRelationships ?? []) {
			const found: Record<string, Json> = {};
			for (const row of database
				.prepare(
					`SELECT ca.code AS child, coalesce(k.key, pa.code) AS parent
					FROM area_relationship r
					JOIN period p ON p.id = r.period_id
					JOIN area_version cv ON cv.id = r.child_version_id
					JOIN area ca ON ca.id = cv.area_id
					JOIN area_releases cr ON cr.position = cv.release_id
					JOIN area_version pv ON pv.id = r.parent_version_id
					JOIN area pa ON pa.id = pv.area_id
					JOIN area_releases pr ON pr.position = pv.release_id
					LEFT JOIN dataset_area_key k ON k.dataset_id = r.dataset_id AND k.area_version_id = pv.id
					WHERE r.dataset_id = ? AND r.relation = ? AND p.label = ? AND cr.geography = ? AND pr.geography = ?
					ORDER BY ca.code`,
				)
				.all(
					dataset,
					link.relation ?? "parent",
					top,
					link.child.geography,
					link.parent.geography,
				))
				found[String(row.child)] = String(row.parent);
			linked[link.field] = found;
		}
		result[key] = {
			...header,
			...linked,
			...(config.election?.results
				? { [config.election.results]: winners }
				: {}),
			...(spec.summary ? spec.summary(data, full) : {}),
			...sections,
		} as Json;
	}
	if (Object.keys(result).length === 0)
		throw new Error(`${slug} has no rows`);
	return JSON.stringify(result);
}

/** The paths a pattern reaches: a binding takes each key already there. */
function expand(
	node: Json | undefined,
	segments: readonly Placeholder[],
	path: string[] = [],
): string[][] {
	if (path.length === segments.length) return [path];
	const segment = segments[path.length];
	if ("literal" in segment)
		return expand(
			node !== null && typeof node === "object"
				? (node as Record<string, Json>)[segment.literal]
				: undefined,
			segments,
			[...path, segment.literal],
		);
	if (node === null || node === undefined || typeof node !== "object")
		return [];
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
