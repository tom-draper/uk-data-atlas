import type { SqliteTable } from "@uk-data-atlas/artifacts";
import type { MeasureDimensionsConfig } from "@uk-data-atlas/measures";

/** Reviewed API mappings, including the mappings supplied by declarations. */
export function measureMappingTables(
	config: MeasureDimensionsConfig,
): Record<string, SqliteTable> {
	return {
		catalogue_measure: {
			strict: true,
			columns: [
				"id TEXT NOT NULL",
				"measure TEXT NOT NULL",
				"dataset TEXT",
			],
			key: ["id"],
			rows: Object.entries(config.ids).map(([id, item]) => [
				id,
				item.measure,
				item.datasetId ?? null,
			]),
		},
		catalogue_measure_member: {
			strict: true,
			columns: [
				"id TEXT NOT NULL REFERENCES catalogue_measure(id)",
				"dimension TEXT NOT NULL",
				"member TEXT NOT NULL",
			],
			key: ["id", "dimension"],
			rows: Object.entries(config.ids).flatMap(([id, item]) =>
				Object.entries(item.dimensions ?? {}).map(
					([dimension, member]) => [id, dimension, member],
				),
			),
		},
		measure_default_member: {
			strict: true,
			columns: [
				"measure TEXT NOT NULL",
				"dimension TEXT NOT NULL",
				"member TEXT NOT NULL",
			],
			key: ["measure", "dimension"],
			rows: Object.entries(config.defaults).flatMap(
				([measure, dimensions]) =>
					Object.entries(dimensions).map(([dimension, member]) => [
						measure,
						dimension,
						member,
					]),
			),
		},
		additional_measure: {
			strict: true,
			columns: [
				"slug TEXT NOT NULL",
				"label TEXT NOT NULL",
				"description TEXT NOT NULL",
				"reason TEXT NOT NULL",
			],
			key: ["slug"],
			rows: Object.entries(config.measures).map(([slug, item]) => [
				slug,
				item.label,
				item.description,
				item.reason,
			]),
		},
		additional_dimension: {
			strict: true,
			columns: [
				"slug TEXT NOT NULL",
				"label TEXT NOT NULL",
				"reason TEXT NOT NULL",
			],
			key: ["slug"],
			rows: Object.entries(config.dimensions).map(([slug, item]) => [
				slug,
				item.label,
				item.reason,
			]),
		},
		additional_dimension_member: {
			strict: true,
			columns: [
				"dimension TEXT NOT NULL",
				"code TEXT NOT NULL",
				"label TEXT NOT NULL",
				"parent TEXT",
				"position INTEGER NOT NULL",
				"additional_dimension INTEGER NOT NULL CHECK (additional_dimension IN (0,1))",
			],
			key: ["dimension", "code"],
			rows: [
				...Object.entries(config.dimensions).flatMap(
					([dimension, item]) =>
						item.members.map((member, position) => [
							dimension,
							member.code,
							member.label,
							member.parent ?? null,
							position,
							1,
						]),
				),
				...Object.entries(config.members).flatMap(
					([dimension, members]) =>
						members.map((member, position) => [
							dimension,
							member.code,
							member.label,
							member.parent ?? null,
							position,
							0,
						]),
				),
			],
		},
	};
}
