import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-db";
import type { MeasureDimensionsConfig } from "./measureDimensions.ts";

/** Reconstruct the reviewed catalogue mappings from the compiled database. */
export function readAtlasMeasureMapping(path: string): MeasureDimensionsConfig {
	const db = openReadOnlyDatabase(path);
	try {
		const config: MeasureDimensionsConfig = {
			schemaVersion: 1,
			measures: {},
			dimensions: {},
			members: {},
			defaults: {},
			ids: {},
		};
		for (const row of db
			.prepare("SELECT * FROM additional_measure ORDER BY slug")
			.all())
			config.measures[String(row.slug)] = {
				label: String(row.label),
				description: String(row.description),
				reason: String(row.reason),
			};
		for (const row of db
			.prepare("SELECT * FROM additional_dimension ORDER BY slug")
			.all())
			config.dimensions[String(row.slug)] = {
				label: String(row.label),
				reason: String(row.reason),
				members: [],
			};
		for (const row of db
			.prepare(
				"SELECT * FROM additional_dimension_member ORDER BY dimension, position, code",
			)
			.all()) {
			const dimension = String(row.dimension);
			const member = {
				code: String(row.code),
				label: String(row.label),
				...(row.parent === null ? {} : { parent: String(row.parent) }),
			};
			if (row.additional_dimension === 1)
				config.dimensions[dimension]!.members.push(member);
			else (config.members[dimension] ??= []).push(member);
		}
		for (const row of db
			.prepare(
				"SELECT * FROM measure_default_member ORDER BY measure, dimension",
			)
			.all())
			(config.defaults[String(row.measure)] ??= {})[
				String(row.dimension)
			] = String(row.member);
		for (const row of db
			.prepare("SELECT * FROM catalogue_measure ORDER BY id")
			.all())
			config.ids[String(row.id)] = {
				measure: String(row.measure),
				...(row.dataset === null
					? {}
					: { datasetId: String(row.dataset) }),
			};
		for (const row of db
			.prepare(
				"SELECT * FROM catalogue_measure_member ORDER BY id, dimension",
			)
			.all())
			(config.ids[String(row.id)]!.dimensions ??= {})[
				String(row.dimension)
			] = String(row.member);
		return config;
	} finally {
		db.release();
	}
}
