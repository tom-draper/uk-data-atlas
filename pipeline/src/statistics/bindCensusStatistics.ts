import type { DatabaseSync } from "node:sqlite";
import type { Measure } from "@uk-data-atlas/catalogue/node";
import { CENSUS_SMALL_AREA_TABLES } from "../catalog/censusSmallArea.ts";
import type { StatisticsSelection } from "./statisticsExport.ts";

/**
 * Bind a complete small-area census measure to its canonical series: the
 * measure and members declared by its census table.
 */
export function bindCensusStatistics(
	database: DatabaseSync,
	measure: Measure,
	allowOtherSources = false,
): StatisticsSelection[] | undefined {
	for (const table of CENSUS_SMALL_AREA_TABLES) {
		const category = table.categories.find(
			([suffix]) => `${table.measurePrefix}-${suffix}` === measure.id,
		);
		if (!category) continue;
		if (measure.unit !== table.unit || !measure.sources.length)
			return undefined;
		const members = { [table.dimension]: category[3] ?? category[0] };
		const dataset = `census-2021-${table.table}`;
		const selection: StatisticsSelection[] = [];
		for (const source of measure.sources) {
			if (source.datasetId !== dataset) {
				if (allowOtherSources) continue;
				return undefined;
			}
			const { type, boundaryYear } = source.sourceGeography;
			if (
				!["lsoa", "msoa"].includes(type) ||
				boundaryYear !== 2021 ||
				source.periods.length !== 1 ||
				source.periods[0] !== "2021"
			)
				return undefined;
			// The series with exactly the mapped members, so a total is not
			// matched by every breakdown of its measure.
			const rows = database
				.prepare(
					`SELECT r.release AS release, p.label AS period, count(*) AS count
				FROM dataset d JOIN series s ON s.dataset_id = d.id
				JOIN measure m ON m.id = s.measure_id
				JOIN area_releases r ON r.id = s.release_id
				JOIN observation o ON o.series_id = s.id
				JOIN period p ON p.id = o.period_id
				WHERE d.slug = ? AND m.slug = ? AND r.geography = ?
				AND (p.label = '2021' OR p.label LIKE '2021-%')
				AND (SELECT count(*) FROM series_member sm WHERE sm.series_id = s.id) = ?
				AND NOT EXISTS (
					SELECT 1 FROM json_each(?) expected WHERE NOT EXISTS (
						SELECT 1 FROM series_member sm
						JOIN dimension dim ON dim.id = sm.dimension_id
						JOIN dimension_member dm ON dm.id = sm.member_id
						WHERE sm.series_id = s.id AND dim.slug = expected.key AND dm.code = expected.value
					)
				)
				GROUP BY r.release, p.label`,
				)
				.all(
					dataset,
					table.measure,
					type,
					Object.keys(members).length,
					JSON.stringify(members),
				);
			if (
				rows.length !== 1 ||
				Number(rows[0]!.count) !== source.coverage.recordCount
			)
				return undefined;
			selection.push({
				dataset,
				measure: table.measure,
				members,
				exact: true,
				geography: type,
				release: String(rows[0]!.release),
				periods: [String(rows[0]!.period)],
			});
		}
		return selection.length ? selection : undefined;
	}
	return undefined;
}
