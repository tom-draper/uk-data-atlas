import { closeSync, openSync, writeFileSync } from "node:fs";
import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import {
	ParquetFileWriter,
	type ParquetColumn,
} from "@uk-data-atlas/artifacts";

const baseColumns = [
	["dataset", "string"],
	["measure", "string"],
	["unit", "string"],
	["geography", "string"],
	["release", "string"],
	["area_code", "string"],
	["period", "string"],
	["value", "double"],
	["lower", "double"],
	["upper", "double"],
	["category", "string"],
	["status", "string"],
] as const;

export function exportStatisticsMeasure(
	database: DatabaseSync,
	measure: string,
	paths: { csv: string; parquet: string },
) {
	const dimensions = database
		.prepare(
			`SELECT DISTINCT d.id, d.slug FROM series s
			JOIN measure m ON m.id = s.measure_id
			JOIN series_member sm ON sm.series_id = s.id
			JOIN dimension d ON d.id = sm.dimension_id
			WHERE m.slug = ? ORDER BY d.slug`,
		)
		.all(measure);
	const columns: ParquetColumn[] = [
		...baseColumns.map(([name, type]) => ({
			name,
			type,
			optional: true,
			values: [],
		})),
		...dimensions.map((dimension) => ({
			name: `dimension_${String(dimension.slug)}`,
			type: "string" as const,
			optional: true,
			values: [],
		})),
	];
	const memberColumns = dimensions
		.map(
			() => `(SELECT dm.code FROM series_member sm
		JOIN dimension_member dm ON dm.id = sm.member_id
		WHERE sm.series_id = s.id AND sm.dimension_id = ?)`,
		)
		.join(", ");
	const statement =
		database.prepare(`SELECT d.slug, m.slug, m.unit, r.geography, r.id,
		a.code, p.label, o.value, o.lower, o.upper, c.code, st.slug
		${memberColumns ? `, ${memberColumns}` : ""}
		FROM series s JOIN measure m ON m.id = s.measure_id
		JOIN dataset d ON d.id = s.dataset_id
		JOIN area_releases r ON r.position = s.release_id
		JOIN observation o ON o.series_id = s.id
		JOIN area_version av ON av.id = o.area_version_id
		JOIN area a ON a.id = av.area_id
		JOIN period p ON p.id = o.period_id
		JOIN status st ON st.id = o.status_id
		LEFT JOIN dimension_member c ON c.id = o.category_id
		WHERE m.slug = ?
		ORDER BY r.geography, r.id, p.label, a.code, d.slug, s.key`);
	statement.setReturnArrays(true);
	const csv = openSync(paths.csv, "w");
	const parquet = new ParquetFileWriter(paths.parquet, { columns });
	const cell = (value: SQLOutputValue) =>
		value === null ? "" : `"${String(value).replaceAll('"', '""')}"`;
	let count = 0;
	let batch: Array<Array<string | number | null>> = columns.map(() => []);
	let csvRows: string[] = [];
	const flush = () => {
		writeFileSync(csv, csvRows.join(""));
		csvRows = [];
		parquet.write(
			columns.map((column, index) => ({
				...column,
				values: batch[index]!,
			})),
		);
		batch = columns.map(() => []);
	};
	try {
		writeFileSync(
			csv,
			`${columns.map((column) => cell(column.name)).join(",")}\r\n`,
		);
		for (const row of statement.iterate(
			...dimensions.map((dimension) => dimension.id as number),
			measure,
		) as unknown as Iterable<SQLOutputValue[]>) {
			csvRows.push(`${row.map(cell).join(",")}\r\n`);
			row.forEach((value, index) =>
				batch[index]!.push(value as string | number | null),
			);
			count++;
			if (count % 2048 === 0) flush();
		}
		if (count % 2048 !== 0) flush();
	} finally {
		closeSync(csv);
		parquet.close();
	}
	return count;
}
