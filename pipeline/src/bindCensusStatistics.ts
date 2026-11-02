import type { DatabaseSync } from "node:sqlite";
import type { Measure } from "@uk-data-atlas/atlas-runtime/catalogue";
import { CENSUS_SMALL_AREA_TABLES } from "./catalog/censusSmallArea";
import type { StatisticsSelection } from "./statisticsExport";

/** Bind a complete small-area census measure to its canonical series. */
export function bindCensusStatistics(
	database: DatabaseSync,
	measure: Measure,
): StatisticsSelection[] | undefined {
	for (const table of CENSUS_SMALL_AREA_TABLES) {
		const category = table.categories.find(
			([suffix]) => `${table.measurePrefix}-${suffix}` === measure.id,
		);
		if (!category) continue;
		if (measure.unit !== table.unit || !measure.sources.length)
			return undefined;
		const dataset = `census-2021-${table.table}`;
		const dimension = `${dataset}-category`;
		const selection: StatisticsSelection[] = [];
		for (const source of measure.sources) {
			const { type, boundaryYear } = source.sourceGeography;
			if (
				!["lsoa", "msoa"].includes(type) ||
				boundaryYear !== 2021 ||
				source.periods.length !== 1 ||
				source.periods[0] !== "2021"
			)
				return undefined;
			const rows = database
				.prepare(
					`SELECT r.id AS release, count(*) AS count
				FROM dataset d JOIN series s ON s.dataset_id = d.id
				JOIN measure m ON m.id = s.measure_id
				JOIN area_releases r ON r.position = s.release_id
				JOIN series_member sm ON sm.series_id = s.id
				JOIN dimension dim ON dim.id = sm.dimension_id
				JOIN dimension_member dm ON dm.id = sm.member_id
				JOIN observation o ON o.series_id = s.id
				JOIN period p ON p.id = o.period_id
				WHERE d.slug = ? AND m.slug = ? AND r.geography = ? AND dim.slug = ? AND dm.code = ? AND p.label = '2021'
				GROUP BY r.id`,
				)
				.all(dataset, `${dataset}-count`, type, dimension, category[0]);
			if (
				rows.length !== 1 ||
				Number(rows[0]!.count) !== source.coverage.recordCount
			)
				return undefined;
			selection.push({
				dataset,
				measure: `${dataset}-count`,
				members: { [dimension]: category[0] },
				geography: type,
				release: String(rows[0]!.release),
				periods: ["2021"],
			});
		}
		return selection;
	}
	return undefined;
}
