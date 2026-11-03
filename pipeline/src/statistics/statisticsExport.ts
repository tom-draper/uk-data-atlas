import { closeSync, openSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { DatabaseSync, SQLOutputValue } from "node:sqlite";
import {
	ParquetFileWriter,
	type ParquetColumn,
} from "@uk-data-atlas/artifacts";
import { electionStatisticsExport } from "./electionStatisticsExport";

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

/** A measure's series, by dimension members, and its canonical source partition. */
export type StatisticsSelection = StatisticsSourceSelection &
	(
		| { measure: string; dimension: string; member: string }
		| { measure: string; members: Record<string, string>; exact?: true }
	);

const selectedRows = `WITH selections AS (SELECT value FROM json_each(?))
	SELECT DISTINCT selected_series.id AS series_id, selected_label.id AS period_id FROM series selected_series
	JOIN dataset selected_dataset ON selected_dataset.id = selected_series.dataset_id
	JOIN measure selected_measure ON selected_measure.id = selected_series.measure_id
	JOIN area_releases selected_release ON selected_release.position = selected_series.release_id
	JOIN selections selection
	JOIN json_each(selection.value, '$.periods') selected_period
	JOIN period selected_label ON selected_label.label = selected_period.value
	WHERE selected_dataset.slug = json_extract(selection.value, '$.dataset')
	AND selected_measure.slug = json_extract(selection.value, '$.measure')
	AND selected_release.geography = json_extract(selection.value, '$.geography')
	AND selected_release.id = json_extract(selection.value, '$.release')
	AND (json_type(selection.value, '$.members') = 'object' OR json_type(selection.value, '$.dimension') = 'text')
	AND (json_extract(selection.value, '$.exact') IS NOT 1 OR
		(SELECT count(*) FROM series_member sm WHERE sm.series_id = selected_series.id) =
		(SELECT count(*) FROM json_each(selection.value, '$.members')))
	AND NOT EXISTS (
		SELECT 1 FROM json_each(COALESCE(json_extract(selection.value, '$.members'),
			json_object(json_extract(selection.value, '$.dimension'), json_extract(selection.value, '$.member')))) expected
		WHERE NOT EXISTS (
			SELECT 1 FROM series_member sm JOIN dimension dim ON dim.id = sm.dimension_id
			JOIN dimension_member dm ON dm.id = sm.member_id
			WHERE sm.series_id = selected_series.id AND dim.slug = expected.key AND dm.code = expected.value
		)
	)
`;

/** Include every canonical period and release for the same series dimensions. */
export function expandStatisticsSelection(
	database: DatabaseSync,
	selection: readonly StatisticsSelection[],
): StatisticsSelection[] {
	const initial = database
		.prepare(`SELECT DISTINCT series_id FROM (${selectedRows})`)
		.all(JSON.stringify(selection));
	const details =
		database.prepare(`SELECT d.slug AS dataset, m.slug AS measure, s.dataset_id, s.measure_id
		FROM series s JOIN dataset d ON d.id = s.dataset_id JOIN measure m ON m.id = s.measure_id WHERE s.id = ?`);
	const dimensions =
		database.prepare(`SELECT dim.slug, dm.code FROM series_member sm
		JOIN dimension dim ON dim.id = sm.dimension_id JOIN dimension_member dm ON dm.id = sm.member_id
		WHERE sm.series_id = ? ORDER BY dim.slug`);
	const related =
		database.prepare(`SELECT r.geography, r.id AS release, p.label AS period
		FROM series s JOIN area_releases r ON r.position = s.release_id
		JOIN observation o ON o.series_id = s.id JOIN period p ON p.id = o.period_id
		WHERE s.dataset_id = ? AND s.measure_id = ?
		AND (SELECT count(*) FROM series_member sm WHERE sm.series_id = s.id) = ?
		AND NOT EXISTS (SELECT 1 FROM json_each(?) expected WHERE NOT EXISTS (
			SELECT 1 FROM series_member sm JOIN dimension dim ON dim.id = sm.dimension_id
			JOIN dimension_member dm ON dm.id = sm.member_id
			WHERE sm.series_id = s.id AND dim.slug = expected.key AND dm.code = expected.value
		)) GROUP BY s.id, p.id ORDER BY r.geography, r.id, p.label`);
	const result = new Map<string, StatisticsSelection>();
	const visited = new Set<string>();
	for (const row of initial) {
		const id = row.series_id as number;
		const series = details.get(id);
		if (!series) throw new Error(`Missing canonical series ${id}`);
		const members = Object.fromEntries(
			dimensions
				.all(id)
				.map((item) => [String(item.slug), String(item.code)]),
		);
		const signature = JSON.stringify([
			series.dataset_id,
			series.measure_id,
			members,
		]);
		if (visited.has(signature)) continue;
		visited.add(signature);
		for (const item of related.all(
			series.dataset_id!,
			series.measure_id!,
			Object.keys(members).length,
			JSON.stringify(members),
		)) {
			const key = JSON.stringify([
				signature,
				item.geography,
				item.release,
			]);
			let entry = result.get(key);
			if (!entry) {
				entry = {
					dataset: String(series.dataset),
					measure: String(series.measure),
					members,
					exact: true,
					geography: String(item.geography),
					release: String(item.release),
					periods: [],
				};
				result.set(key, entry);
			}
			if (!entry.periods.includes(String(item.period)))
				entry.periods.push(String(item.period));
		}
	}
	return [...result.values()];
}

export function hashStatisticsSelection(
	database: DatabaseSync,
	selection: readonly StatisticsSelection[],
) {
	const query = database.prepare(`SELECT a.code, o.value, st.slug
		FROM (${selectedRows}) selected
		CROSS JOIN observation o ON o.series_id = selected.series_id AND o.period_id = selected.period_id
		JOIN series s ON s.id = o.series_id
		JOIN area_version av ON av.id = o.area_version_id
		JOIN area a ON a.id = av.area_id
		JOIN status st ON st.id = o.status_id
		ORDER BY a.code, s.key, o.period_id`);
	query.setReturnArrays(true);
	const hash = createHash("sha256");
	let recordCount = 0;
	for (const row of query.iterate(
		JSON.stringify(selection),
	) as unknown as Iterable<SQLOutputValue[]>) {
		hash.update(`${JSON.stringify(row)}\n`);
		recordCount++;
	}
	return { recordCount, recordHash: hash.digest("hex") };
}

export function exportStatisticsMeasure(
	database: DatabaseSync,
	measure: string,
	paths: { csv: string; parquet: string },
	selection?: readonly StatisticsSelection[],
) {
	const source = selection
		? `(${selectedRows}) selected CROSS JOIN observation o ON o.series_id = selected.series_id AND o.period_id = selected.period_id JOIN series s ON s.id = o.series_id`
		: "series s JOIN observation o ON o.series_id = s.id";
	const filter = selection ? "1" : "m.slug = ?";
	const dimensionFilter = selection
		? `s.id IN (SELECT series_id FROM (${selectedRows}))`
		: "m.slug = ?";
	const parameter = selection ? JSON.stringify(selection) : measure;
	const election = electionStatisticsExport(measure);
	const dimensions = election
		? election.party
			? [{ id: 0, slug: "party" }]
			: []
		: measure === "population" || measure === "population-density"
			? []
			: database
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
	const intervalMeasure =
		measure === "unemployment-rate"
			? "unemployment-rate-interval"
			: measure === "unemployment-level"
				? "unemployed-people-interval"
				: undefined;
	const intervalJoins = intervalMeasure
		? `LEFT JOIN measure im ON im.slug = '${intervalMeasure}'
		LEFT JOIN series ins ON ins.dataset_id = s.dataset_id AND ins.release_id = s.release_id AND ins.measure_id = im.id
		LEFT JOIN observation ino ON ino.series_id = ins.id AND ino.area_version_id = o.area_version_id AND ino.period_id = o.period_id`
		: "";
	const lower = intervalMeasure ? "round(o.value - ino.value, 1)" : "o.lower";
	const upper = intervalMeasure ? "round(o.value + ino.value, 1)" : "o.upper";
	const density = measure === "population-density";
	const housePrice = measure === "house-price-median";
	const aggregatePopulation = measure === "population" || density;
	const landArea = `(SELECT lo.value / 100.0 FROM dataset ld JOIN series ls ON ls.dataset_id=ld.id
		JOIN measure lm ON lm.id=ls.measure_id JOIN series_member lsm ON lsm.series_id=ls.id
		JOIN dimension ldim ON ldim.id=lsm.dimension_id JOIN dimension_member ldm ON ldm.id=lsm.member_id
		JOIN observation lo ON lo.series_id=ls.id JOIN area_version lav ON lav.id=lo.area_version_id
		JOIN period lp ON lp.id=lo.period_id WHERE ld.slug='land-area' AND lm.slug='area'
		AND ldim.slug='surface' AND ldm.code='land' AND lp.label='2024' AND lav.area_id=a.id LIMIT 1)`;
	const values = density
		? `CASE WHEN count(o.value) = count(*) THEN sum(o.value) / nullif(${landArea}, 0) END, NULL, NULL, NULL, 'derived'`
		: aggregatePopulation
			? "CASE WHEN count(o.value) = count(*) THEN sum(o.value) END, NULL, NULL, NULL, CASE WHEN count(DISTINCT st.slug) = 1 THEN min(st.slug) ELSE 'derived' END"
			: `o.value, ${lower}, ${upper}, c.code, st.slug`;
	const houseJoin = housePrice
		? `LEFT JOIN (
		SELECT DISTINCT r.child_version_id AS area_version_id, parent_area.code FROM area_relationship r
		JOIN area_version parent_version ON parent_version.id=r.parent_version_id JOIN area parent_area ON parent_area.id=parent_version.area_id
		WHERE r.relation='published-as' AND r.dataset_id=(SELECT id FROM dataset WHERE slug='house-price')
	) house_parent ON house_parent.area_version_id=o.area_version_id`
		: "";
	const areaCode = housePrice
		? "CASE WHEN a.code='E05013831' THEN 'E05011412' ELSE coalesce(house_parent.code,a.code) END"
		: "a.code";
	const release = housePrice
		? `coalesce((SELECT r2.id FROM area a2 JOIN area_version av2 ON av2.area_id=a2.id JOIN area_releases r2 ON r2.position=av2.release_id WHERE a2.code=${areaCode} AND r2.geography='ward' AND r2.id LIKE '2020-%' LIMIT 1), r.id)`
		: "r.id";
	const statement = database.prepare(
		election?.sql ??
			`SELECT d.slug, ?, ${density ? "'people per square kilometre'" : "m.unit"}, r.geography, ${release},
		${areaCode}, p.label, ${values}
		${memberColumns ? `, ${memberColumns}` : ""}
		FROM ${source} JOIN measure m ON m.id = s.measure_id
		JOIN dataset d ON d.id = s.dataset_id
		JOIN area_releases r ON r.position = s.release_id
		JOIN area_version av ON av.id = o.area_version_id
		JOIN area a ON a.id = av.area_id
		JOIN period p ON p.id = o.period_id
		JOIN status st ON st.id = o.status_id
		LEFT JOIN dimension_member c ON c.id = o.category_id
		${intervalJoins}
		${houseJoin}
		WHERE ${filter}
		${aggregatePopulation ? "GROUP BY d.slug, m.unit, r.geography, r.id, a.code, p.label" : ""}
		ORDER BY 4, 5, 7, 6, 1${aggregatePopulation ? "" : ", s.key"}`,
	);
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
		const parameters = election
			? [measure]
			: [
					measure,
					...dimensions.map((dimension) => dimension.id as number),
					parameter,
				];
		for (const row of statement.iterate(
			...parameters,
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
