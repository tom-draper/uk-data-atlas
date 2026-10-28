import type { DatabaseSync } from "node:sqlite";
import type { DerivedRule, Json } from "./declaredStatistics";

type Leaf = {
	path: string[];
	kind: string;
	series: number | null;
	period: number | null;
	rule: string | null;
	literal: string | null;
};

type Row = {
	code: string;
	name: string;
	series_id: number;
	period_id: number;
	value: number | null;
	lower: number | null;
	upper: number | null;
};

const place = (record: Record<string, Json>, path: string[], value: Json) => {
	let node = record;
	for (const key of path.slice(0, -1)) {
		const child = node[key];
		if (child === undefined) node = node[key] = {};
		else if (
			child !== null &&
			typeof child === "object" &&
			!Array.isArray(child)
		)
			node = child;
		else throw new Error(`Layout path ${path.join(".")} crosses a value`);
	}
	node[path[path.length - 1]] = value;
};

/**
 * Records keyed by area code, in code order, laid out from one record set's
 * leaves. A leaf names the first record's series; records on another release
 * read the series with the same measure and members, through `shapes`.
 */
function records(
	database: DatabaseSync,
	dataset: number,
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
	const rows = database
		.prepare(
			`SELECT a.code, coalesce(n.name, v.name) AS name, o.series_id, o.period_id, o.value, o.lower, o.upper
			FROM observation o
			JOIN area_version v ON v.id = o.area_version_id
			JOIN area a ON a.id = v.area_id
			LEFT JOIN dataset_area_name n ON n.dataset_id = ? AND n.area_version_id = v.id
			WHERE o.series_id IN (${series.map(() => "?").join(",")})
			AND o.period_id IN (${periods.map(() => "?").join(",")})
			ORDER BY a.code`,
		)
		.all(dataset, ...series, ...periods) as unknown as Row[];
	const result: Record<string, Json> = {};
	const build = (code: string, name: string, cells: Map<string, Row>) => {
		const record: Record<string, Json> = {};
		for (const leaf of leaves) {
			let value: Json;
			if (leaf.series !== null) {
				const row = cells.get(`${shape(leaf.series)}:${leaf.period}`);
				const found = row?.[leaf.kind as "value" | "lower" | "upper"];
				if (found === undefined || found === null)
					throw new Error(
						`${slug}: ${code} has no ${leaf.kind} for ${leaf.path.join(".")}`,
					);
				value = found;
			} else if (leaf.kind === "code") value = code;
			else if (leaf.kind === "name") value = name;
			else if (leaf.kind === "literal") value = JSON.parse(leaf.literal!);
			else value = null;
			place(record, leaf.path, value);
		}
		for (const [rule, compute] of Object.entries(rules))
			for (const leaf of derived)
				if (leaf.rule === rule)
					place(record, leaf.path, compute(record));
		result[code] = record;
	};
	let current:
		{ code: string; name: string; cells: Map<string, Row> } | undefined;
	for (const row of rows) {
		const key = `${shape(row.series_id)}:${row.period_id}`;
		if (!wanted.has(key)) continue;
		if (current?.code !== row.code) {
			if (current) build(current.code, current.name, current.cells);
			current = { code: row.code, name: row.name, cells: new Map() };
		}
		if (current.cells.has(key))
			throw new Error(`${slug}: ${row.code} has two values for one leaf`);
		current.cells.set(key, row);
	}
	if (current) build(current.code, current.name, current.cells);
	return result;
}

/**
 * The compiled JSON of a dataset, rebuilt from its rows: parts in order, each
 * header with its record sets laid out in area code order.
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
		"SELECT records, path, kind, series_id AS series, period_id AS period, rule, literal FROM dataset_leaf WHERE dataset_id = ? AND part = ? ORDER BY records, position",
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
			});
		}
		for (const [from, leaves] of sets) {
			if (header[from] !== null)
				throw new Error(`${slug} ${part.key}: no slot for ${from}`);
			header[from] = records(
				database,
				dataset,
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
