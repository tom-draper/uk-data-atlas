import type { DatabaseSync } from "node:sqlite";
import type { DerivedRule, Json } from "./declaredStatistics";

type Leaf = {
	path: (string | number)[];
	kind: string;
	series: number | null;
	period: number | null;
	rule: string | null;
	literal: string | null;
	parent: number | null;
};

type Row = {
	area: number;
	series_id: number;
	period_id: number;
	value: number | null;
	lower: number | null;
	upper: number | null;
};

type Node = Record<string, Json> | Json[];

/** Set a leaf, making the objects and arrays above it; a number keys an array. */
const place = (record: Node, path: (string | number)[], value: Json) => {
	let node = record as Record<string | number, Json>;
	for (const [index, key] of path.slice(0, -1).entries()) {
		const child = node[key];
		const array = typeof path[index + 1] === "number";
		if (child === undefined)
			node = (node[key] = array ? [] : {}) as Record<
				string | number,
				Json
			>;
		else if (
			child !== null &&
			typeof child === "object" &&
			Array.isArray(child) === array
		)
			node = child as Record<string | number, Json>;
		else throw new Error(`Layout path ${path.join(".")} crosses a value`);
	}
	node[path[path.length - 1]] = value;
};

/**
 * One record set's records keyed by area code, in their stored order. A leaf
 * names the first record's series; records on another release read the series
 * with the same measure and members, through `shapes`.
 */
function records(
	database: DatabaseSync,
	dataset: number,
	part: number,
	from: string,
	slug: string,
	leaves: Leaf[],
	rules: Readonly<Record<string, DerivedRule>>,
	shapes: ReadonlyMap<number, string>,
) {
	const valued = leaves.filter((leaf) => leaf.series !== null);
	const derived = leaves.filter((leaf) => leaf.kind === "derived");
	for (const leaf of derived)
		if (!rules[leaf.rule!])
			throw new Error(
				`${slug}: derived ${leaf.rule} has no rebuild rule`,
			);
	const shape = (series: number) => {
		const found = shapes.get(series);
		if (found === undefined)
			throw new Error(`${slug}: series ${series} is not in the dataset`);
		return found;
	};
	const wantedShapes = new Set(valued.map((leaf) => shape(leaf.series!)));
	const series = [...shapes]
		.filter(([, value]) => wantedShapes.has(value))
		.map(([id]) => id);
	const periods = [...new Set(valued.map((leaf) => leaf.period!))];
	const wanted = new Set(
		valued.map((leaf) => `${shape(leaf.series!)}:${leaf.period}`),
	);
	const cells = new Map<number, Map<string, Row>>();
	for (const row of database
		.prepare(
			`SELECT o.area_version_id AS area, o.series_id, o.period_id, o.value, o.lower, o.upper
			FROM dataset_record r
			JOIN observation o ON o.area_version_id = r.area_version_id
			WHERE r.dataset_id = ? AND r.part = ? AND r.records = ?
			AND o.series_id IN (${series.map(() => "?").join(",")})
			AND o.period_id IN (${periods.map(() => "?").join(",")})`,
		)
		.all(dataset, part, from, ...series, ...periods) as unknown as Row[]) {
		const key = `${shape(row.series_id)}:${row.period_id}`;
		if (!wanted.has(key)) continue;
		let found = cells.get(row.area);
		if (!found) cells.set(row.area, (found = new Map()));
		if (found.has(key))
			throw new Error(
				`${slug}: area ${row.area} has two values for one leaf`,
			);
		found.set(key, row);
	}
	const parents = new Map<
		number,
		Map<number, { code: string; name: string }>
	>();
	for (const row of database
		.prepare(
			`SELECT p.position, p.parent, a.code, coalesce(n.name, v.name) AS name
			FROM dataset_record_parent p
			JOIN area_version v ON v.id = p.area_version_id
			JOIN area a ON a.id = v.area_id
			LEFT JOIN dataset_area_name n ON n.dataset_id = p.dataset_id AND n.area_version_id = v.id
			WHERE p.dataset_id = ? AND p.part = ? AND p.records = ?`,
		)
		.all(dataset, part, from) as {
		position: number;
		parent: number;
		code: string;
		name: string;
	}[]) {
		let found = parents.get(row.position);
		if (!found) parents.set(row.position, (found = new Map()));
		found.set(row.parent, row);
	}
	const absent = new Map<number, Set<number>>();
	for (const row of database
		.prepare(
			"SELECT position, leaf FROM dataset_record_absent WHERE dataset_id = ? AND part = ? AND records = ?",
		)
		.all(dataset, part, from) as { position: number; leaf: number }[]) {
		let found = absent.get(row.position);
		if (!found) absent.set(row.position, (found = new Set()));
		found.add(row.leaf);
	}
	const result: Record<string, Json> = {};
	for (const { position, area, code, name } of database
		.prepare(
			`SELECT r.position, r.area_version_id AS area, a.code, coalesce(n.name, v.name) AS name
			FROM dataset_record r
			JOIN area_version v ON v.id = r.area_version_id
			JOIN area a ON a.id = v.area_id
			LEFT JOIN dataset_area_name n ON n.dataset_id = r.dataset_id AND n.area_version_id = v.id
			WHERE r.dataset_id = ? AND r.part = ? AND r.records = ?
			ORDER BY r.position`,
		)
		.all(dataset, part, from) as {
		position: number;
		area: number;
		code: string;
		name: string;
	}[]) {
		const values = cells.get(area);
		const record: Record<string, Json> = {};
		const lacking = absent.get(position);
		for (const [index, leaf] of leaves.entries()) {
			if (lacking?.has(index)) continue;
			let value: Json;
			if (leaf.series !== null) {
				const row = values?.get(`${shape(leaf.series)}:${leaf.period}`);
				// A value with no observation is null in the file.
				value = row?.[leaf.kind as "value" | "lower" | "upper"] ?? null;
			} else if (leaf.kind === "code") value = code;
			else if (leaf.kind === "name") value = name;
			else if (
				leaf.kind === "parent_code" ||
				leaf.kind === "parent_name"
			) {
				const parent = parents.get(position)?.get(leaf.parent!);
				if (!parent)
					throw new Error(
						`${slug}: ${code} has no parent for ${leaf.path.join(".")}`,
					);
				value = leaf.kind === "parent_code" ? parent.code : parent.name;
			} else if (leaf.kind === "literal")
				value = JSON.parse(leaf.literal!);
			else value = null;
			place(record, leaf.path, value);
		}
		for (const [rule, compute] of Object.entries(rules))
			for (const leaf of derived)
				if (leaf.rule === rule && !lacking?.has(leaves.indexOf(leaf)))
					place(
						record,
						leaf.path,
						compute(record, leaf.path.map(String)),
					);
		result[code] = record;
	}
	return result;
}

/**
 * The compiled JSON of a dataset, rebuilt from its rows: parts in order, each
 * header with its record sets laid out in their stored order.
 */
export function rebuildFromLayout(
	database: DatabaseSync,
	slug: string,
	rules: Readonly<Record<string, DerivedRule>> = {},
): string {
	const dataset = database
		.prepare("SELECT id FROM dataset WHERE slug = ?")
		.get(slug)?.id;
	if (typeof dataset !== "number") throw new Error(`Unknown dataset ${slug}`);
	const parts = database
		.prepare(
			"SELECT position, key, header FROM dataset_part WHERE dataset_id = ? ORDER BY position",
		)
		.all(dataset);
	if (parts.length === 0) throw new Error(`Dataset ${slug} has no layout`);
	const shapes = new Map(
		database
			.prepare(
				`SELECT s.id, s.measure_id || '/' || coalesce((
					SELECT group_concat(member_id, ',') FROM (
						SELECT member_id FROM series_member WHERE series_id = s.id ORDER BY dimension_id
					)
				), '') AS shape
				FROM series s WHERE s.dataset_id = ?`,
			)
			.all(dataset)
			.map((row) => [Number(row.id), String(row.shape)]),
	);
	const leafQuery = database.prepare(
		"SELECT records, path, kind, series_id AS series, period_id AS period, rule, literal, parent FROM dataset_leaf WHERE dataset_id = ? AND part = ? ORDER BY records, position",
	);
	const result: Record<string, Json> = {};
	for (const part of parts) {
		const header = JSON.parse(String(part.header)) as Record<string, Json>;
		const sets = new Map<string, Leaf[]>();
		for (const row of leafQuery.all(dataset, part.position)) {
			const from = String(row.records);
			let leaves = sets.get(from);
			if (!leaves) sets.set(from, (leaves = []));
			leaves.push({
				path: JSON.parse(String(row.path)),
				kind: String(row.kind),
				series: row.series as number | null,
				period: row.period as number | null,
				rule: row.rule as string | null,
				literal: row.literal as string | null,
				parent: row.parent as number | null,
			});
		}
		for (const [from, leaves] of sets) {
			if (header[from] !== null)
				throw new Error(`${slug} ${part.key}: no slot for ${from}`);
			header[from] = records(
				database,
				dataset,
				Number(part.position),
				from,
				slug,
				leaves,
				rules,
				shapes,
			);
		}
		result[String(part.key)] = header;
	}
	return JSON.stringify(result);
}
