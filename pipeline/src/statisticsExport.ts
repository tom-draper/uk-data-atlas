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

type StatisticsSourceSelection = {
	dataset: string;
	geography: string;
	release: string;
	periods: string[];
};

/** A compiled field or dimension member and its canonical source partition. */
export type StatisticsSelection = StatisticsSourceSelection &
	(
		| { path: string[] }
		| { measure: string; dimension: string; member: string }
	);

const selectedRows = `WITH selections AS (SELECT value FROM json_each(?))
	SELECT leaf.series_id, leaf.period_id FROM dataset_leaf leaf
	JOIN dataset selected_dataset ON selected_dataset.id = leaf.dataset_id
	JOIN series selected_series ON selected_series.id = leaf.series_id
	JOIN area_releases selected_release ON selected_release.position = selected_series.release_id
	JOIN period selected_label ON selected_label.id = leaf.period_id
	JOIN selections selection
	WHERE leaf.kind = 'value'
	AND selected_dataset.slug = json_extract(selection.value, '$.dataset')
	AND json(leaf.path) = json_extract(selection.value, '$.path')
	AND selected_release.geography = json_extract(selection.value, '$.geography')
	AND selected_release.id = json_extract(selection.value, '$.release')
	AND EXISTS (SELECT 1 FROM json_each(selection.value, '$.periods') selected_period
		WHERE selected_period.value = selected_label.label)
	UNION
	SELECT selected_series.id, selected_label.id FROM series selected_series
	JOIN dataset selected_dataset ON selected_dataset.id = selected_series.dataset_id
	JOIN measure selected_measure ON selected_measure.id = selected_series.measure_id
	JOIN area_releases selected_release ON selected_release.position = selected_series.release_id
	JOIN series_member selected_member ON selected_member.series_id = selected_series.id
	JOIN dimension selected_dimension ON selected_dimension.id = selected_member.dimension_id
	JOIN dimension_member selected_code ON selected_code.id = selected_member.member_id
	JOIN selections selection
	JOIN json_each(selection.value, '$.periods') selected_period
	JOIN period selected_label ON selected_label.label = selected_period.value
	WHERE selected_dataset.slug = json_extract(selection.value, '$.dataset')
	AND selected_measure.slug = json_extract(selection.value, '$.measure')
	AND selected_release.geography = json_extract(selection.value, '$.geography')
	AND selected_release.id = json_extract(selection.value, '$.release')
	AND selected_dimension.slug = json_extract(selection.value, '$.dimension')
	AND selected_code.code = json_extract(selection.value, '$.member')
`;

export function exportStatisticsMeasure(
	database: DatabaseSync,
	measure: string,
	paths: { csv: string; parquet: string },
	selection?: readonly StatisticsSelection[],
) {
	const filter = selection
		? `(s.id, o.period_id) IN (${selectedRows})`
		: "m.slug = ?";
	const dimensionFilter = selection
		? `s.id IN (SELECT series_id FROM (${selectedRows}))`
		: "m.slug = ?";
	const parameter = selection ? JSON.stringify(selection) : measure;
	const dimensions = database
		.prepare(
			`SELECT DISTINCT d.id, d.slug FROM series s
			JOIN measure m ON m.id = s.measure_id
			JOIN area_releases r ON r.position = s.release_id
			JOIN series_member sm ON sm.series_id = s.id
			JOIN dimension d ON d.id = sm.dimension_id
			WHERE ${dimensionFilter} ORDER BY d.slug`,
		)
		.all(parameter);
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
		database.prepare(`SELECT d.slug, ?, m.unit, r.geography, r.id,
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
		WHERE ${filter}
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
			measure,
			...dimensions.map((dimension) => dimension.id as number),
			parameter,
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
