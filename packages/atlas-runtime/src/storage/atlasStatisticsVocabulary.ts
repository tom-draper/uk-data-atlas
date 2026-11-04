import type { StatisticsVocabulary } from "@uk-data-atlas/measures";
import { openReadOnlyDatabase } from "./readOnlyDatabase.ts";

/**
 * The measures and dimensions the statistics tables hold, in the form the
 * API's checked-in vocabulary is written in. Members keep the publisher's
 * order (`position`), and a parent is named by its code.
 */
export function readStatisticsVocabulary(path: string): StatisticsVocabulary {
	const database = openReadOnlyDatabase(path);
	try {
		const measures: StatisticsVocabulary["measures"] = {};
		for (const row of database
			.prepare(
				"SELECT slug, label, description, unit, value_kind, aggregation FROM measure ORDER BY slug",
			)
			.all())
			measures[String(row.slug)] = {
				label: String(row.label),
				description: String(row.description),
				unit: String(row.unit),
				valueKind: String(row.value_kind),
				aggregation: String(row.aggregation),
			};
		const dimensions: StatisticsVocabulary["dimensions"] = {};
		for (const row of database
			.prepare("SELECT slug, label FROM dimension ORDER BY slug")
			.all())
			dimensions[String(row.slug)] = {
				label: String(row.label),
				members: [],
			};
		for (const row of database
			.prepare(
				"SELECT d.slug AS dimension, m.code, m.label, p.code AS parent FROM dimension_member m JOIN dimension d ON d.id = m.dimension_id LEFT JOIN dimension_member p ON p.id = m.parent_id ORDER BY d.slug, m.position, m.code",
			)
			.all())
			dimensions[String(row.dimension)]!.members.push({
				code: String(row.code),
				label: String(row.label),
				...(row.parent === null ? {} : { parent: String(row.parent) }),
			});
		return { schemaVersion: 1, measures, dimensions };
	} finally {
		database.release();
	}
}
