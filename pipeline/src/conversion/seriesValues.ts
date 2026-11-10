import type { DatabaseSync } from "node:sqlite";

/** Reads of the published series a conversion starts from or is checked against. */

export type SeriesRow = {
	id: number;
	key: string;
	dataset: string;
	measure: string;
	releaseId: number;
	/** The dimension members of the series, as its key spells them. */
	members: string;
};

export type SeriesSelector = {
	dataset: string;
	measure: string;
	release: number;
};

/** `dataset/measure/geography:release/dim=member/...` without its first three parts. */
export const membersOfKey = (key: string) => key.split("/").slice(3).join("/");

/** The published series of a dataset's measure on a release, in id order. */
export const publishedSeries = (
	database: DatabaseSync,
	{ dataset, measure, release }: SeriesSelector,
): SeriesRow[] =>
	(
		database
			.prepare(
				`SELECT s.id, s.key, d.slug AS dataset, m.slug AS measure, s.release_id AS releaseId
				FROM series s
				JOIN dataset d ON d.id = s.dataset_id
				JOIN measure m ON m.id = s.measure_id
				WHERE d.slug = ? AND m.slug = ? AND s.release_id = ? AND s.method = 'published'
				ORDER BY s.id`,
			)
			.all(dataset, measure, release) as Omit<SeriesRow, "members">[]
	).map((row) => ({ ...row, members: membersOfKey(row.key) }));

export type PeriodRow = { id: number; label: string; start: string };

export const periodsOfSeries = (
	database: DatabaseSync,
	series: number,
): PeriodRow[] =>
	database
		.prepare(
			`SELECT p.id, p.label, p.start_date AS start
			FROM (SELECT DISTINCT period_id FROM observation WHERE series_id = ?) o
			JOIN period p ON p.id = o.period_id
			ORDER BY p.start_date, p.id`,
		)
		.all(series) as PeriodRow[];

/** The values a series holds for a period, by area version. Rows without a value are left out. */
export const valuesOfSeries = (
	database: DatabaseSync,
	series: number,
	period: number,
): Map<number, number> => {
	const values = new Map<number, number>();
	for (const row of database
		.prepare(
			"SELECT area_version_id AS area, value FROM observation WHERE series_id = ? AND period_id = ? AND value IS NOT NULL",
		)
		.all(series, period) as { area: number; value: number }[])
		values.set(row.area, row.value);
	return values;
};

export type AreaName = { code: string; name: string };

export const areaNamer = (database: DatabaseSync) => {
	const statement = database.prepare(
		"SELECT a.code, v.name FROM area_version v JOIN area a ON a.id = v.area_id WHERE v.id = ?",
	);
	return (areaVersion: number): AreaName =>
		(statement.get(areaVersion) as AreaName | undefined) ?? {
			code: String(areaVersion),
			name: "",
		};
};
