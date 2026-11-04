import type { DatabaseSync } from "node:sqlite";
import { observationArtifactName, type Measure } from "@uk-data-atlas/measures";
import type { StatisticsReadPath } from "@uk-data-atlas/atlas-runtime/storage";
import {
	expandStatisticsSelection,
	type StatisticsSelection,
} from "./statisticsExport.ts";

/**
 * The selector options this binder follows. A selector using any other
 * (a ratio, zeros for absent rows, served codes) serves values its series
 * do not hold as they are, so it is not bound here.
 */
const PLAIN_SELECTOR = new Set([
	"datasetId",
	"measure",
	"dimensions",
	"geography",
	"areasIn",
	"sum",
]);

/** Use the reviewed exact read path for newly migrated catalogue partitions. */
export function bindReviewedStatistics(
	database: DatabaseSync,
	measure: Measure,
	reviewed: StatisticsReadPath,
): StatisticsSelection[] | undefined {
	const selected: StatisticsSelection[] = [];
	for (const source of measure.sources) {
		const selector =
			reviewed.statistics[observationArtifactName(measure.id, source)];
		if (
			!selector ||
			"kind" in selector ||
			Object.keys(selector).some((key) => !PLAIN_SELECTOR.has(key)) ||
			selector.datasetId !== source.datasetId ||
			(selector.sum?.length && measure.id !== "population")
		)
			return undefined;
		const series = database
			.prepare(
				`SELECT s.id, r.id AS release, p.label AS period
			FROM series s JOIN dataset d ON d.id=s.dataset_id JOIN measure m ON m.id=s.measure_id
			JOIN area_releases r ON r.position=s.release_id JOIN observation o ON o.series_id=s.id
			JOIN period p ON p.id=o.period_id WHERE d.slug=? AND m.slug=? AND r.geography=?
			GROUP BY s.id, p.id`,
			)
			.all(selector.datasetId, selector.measure, selector.geography);
		const members = database.prepare(
			`SELECT d.slug, dm.code FROM series_member sm JOIN dimension d ON d.id=sm.dimension_id JOIN dimension_member dm ON dm.id=sm.member_id WHERE sm.series_id=?`,
		);
		const periods = new Set<string>();
		for (const row of series) {
			const dimensions = Object.fromEntries(
				members
					.all(row.id!)
					.map((item) => [String(item.slug), String(item.code)]),
			);
			if (
				Object.entries(selector.dimensions).some(
					([key, value]) => dimensions[key] !== value,
				) ||
				Object.keys(dimensions).some(
					(key) =>
						!(key in selector.dimensions) &&
						!selector.sum?.includes(key),
				)
			)
				continue;
			periods.add(String(row.period));
			selected.push({
				dataset: selector.datasetId,
				measure: selector.measure,
				members: dimensions,
				exact: true,
				geography: selector.geography,
				release: String(row.release),
				periods: [String(row.period)],
			});
		}
		if (
			source.periods.some(
				(period) =>
					![...periods].some(
						(label) =>
							label === period || label.startsWith(`${period}-`),
					),
			)
		)
			return undefined;
	}
	return selected.length
		? expandStatisticsSelection(database, selected)
		: undefined;
}
