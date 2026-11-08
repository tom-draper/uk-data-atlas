import type { DatabaseSync } from "node:sqlite";
import type { CompiledMeasure } from "../catalog/manifest.ts";
import {
	declaredFieldSeries,
	type DatasetLookup,
} from "./declaredFieldSeries.ts";
import {
	hashStatisticsSelection,
	type StatisticsSelection,
} from "./statisticsExport.ts";

type Field = NonNullable<CompiledMeasure["statisticsField"]>;

const equivalentUnits: Record<string, string> = {
	"% of premises": "percent of premises",
	"reported collisions": "collisions",
	"µg/m³": "micrograms per cubic metre",
	"£ thousand": "gbp thousand",
	"£": "gbp",
	"£ per year": "gbp per year",
	"£ per hour": "gbp per hour",
};

/** Resolve a source field only when its canonical rows reproduce the published records. */
export function bindStatisticsField(
	database: DatabaseSync,
	field: Field,
	unit: string,
	lookup?: DatasetLookup,
): StatisticsSelection[] | undefined {
	const units = JSON.stringify([unit, equivalentUnits[unit] ?? unit]);
	const rows = database.prepare(`SELECT DISTINCT r.release AS release
		FROM series s JOIN dataset d ON d.id = s.dataset_id
		JOIN measure m ON m.id = s.measure_id
		JOIN area_releases r ON r.id = s.release_id
		JOIN observation o ON o.series_id = s.id
		JOIN period p ON p.id = o.period_id
		WHERE d.slug = ? AND m.slug = ? AND m.unit IN (SELECT value FROM json_each(?)) AND r.geography = ?
		AND p.label = ?
		AND (SELECT count(*) FROM series_member sm WHERE sm.series_id = s.id) = ?
		AND NOT EXISTS (
			SELECT 1 FROM json_each(?) expected WHERE NOT EXISTS (
				SELECT 1 FROM series_member sm JOIN dimension dim ON dim.id = sm.dimension_id
				JOIN dimension_member dm ON dm.id = sm.member_id
				WHERE sm.series_id = s.id AND dim.slug = expected.key AND dm.code = expected.value
			)
		) ORDER BY r.release`);
	const selection: StatisticsSelection[] = [];
	for (const candidate of declaredFieldSeries(
		database,
		field.dataset,
		field.field.split("."),
		field.sourcePeriod,
		lookup,
	)) {
		if (candidate.period !== field.publishedPeriod) continue;
		for (const row of rows.all(
			field.dataset,
			candidate.measure,
			units,
			field.geography,
			candidate.period,
			Object.keys(candidate.members).length,
			JSON.stringify(candidate.members),
		))
			selection.push({
				dataset: field.dataset,
				measure: candidate.measure,
				members: candidate.members,
				exact: true,
				geography: field.geography,
				release: String(row.release),
				periods: [candidate.period],
			});
	}
	if (!selection.length) return undefined;
	const actual = hashStatisticsSelection(database, selection);
	return actual.recordCount === field.recordCount &&
		actual.recordHash === field.recordHash
		? selection
		: undefined;
}
