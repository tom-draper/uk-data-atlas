import type { DatabaseSync } from "node:sqlite";
import type { Measure } from "@uk-data-atlas/catalogue/node";
import type { MeasureSeriesIdentity } from "@uk-data-atlas/measures";
import {
	expandStatisticsSelection,
	type StatisticsSelection,
} from "./statisticsExport.ts";

/**
 * Bind a catalogue measure to the stored series it names: its measure and
 * members, on each source's dataset and geography, in every release that
 * holds the source's periods. A period is met by the label that equals it or
 * the one extending it, as a census day extends its year.
 *
 * A measure no stored series answers to, or one with a source period no
 * release holds, is not bound rather than bound in part.
 */
export function bindCatalogueSeries(
	database: DatabaseSync,
	measure: Pick<Measure, "sources">,
	identity: MeasureSeriesIdentity | undefined,
): StatisticsSelection[] | undefined {
	if (!identity || !measure.sources.length) return undefined;
	const lookup =
		database.prepare(`SELECT DISTINCT r.release AS release, p.label AS period
		FROM dataset d JOIN series s ON s.method = 'published' AND s.dataset_id = d.id
		JOIN measure m ON m.id = s.measure_id
		JOIN area_release r ON r.id = s.release_id
		JOIN observation o ON o.series_id = s.id JOIN period p ON p.id = o.period_id
		WHERE d.slug = ? AND m.slug = ? AND r.geography = ? AND (p.label = ? OR p.label LIKE ?)
		AND (SELECT count(*) FROM series_member sm WHERE sm.series_id = s.id) = ?
		AND NOT EXISTS (SELECT 1 FROM json_each(?) expected WHERE NOT EXISTS (
			SELECT 1 FROM series_member sm JOIN dimension dim ON dim.id = sm.dimension_id
			JOIN dimension_member dm ON dm.id = sm.member_id
			WHERE sm.series_id = s.id AND dim.slug = expected.key AND dm.code = expected.value
		)) ORDER BY r.release, p.label`);
	const members = identity.dimensions ?? {};
	const selected: StatisticsSelection[] = [];
	for (const source of measure.sources) {
		const { type } = source.sourceGeography;
		for (const period of source.periods) {
			const rows = lookup.all(
				source.datasetId,
				identity.measure,
				type,
				period,
				`${period}-%`,
				Object.keys(members).length,
				JSON.stringify(members),
			);
			if (!rows.length) return undefined;
			for (const row of rows)
				selected.push({
					dataset: source.datasetId,
					measure: identity.measure,
					members,
					exact: true,
					geography: type,
					release: String(row.release),
					periods: [String(row.period)],
				});
		}
	}
	const expanded = expandStatisticsSelection(database, selected);
	return expanded.length ? expanded : undefined;
}
