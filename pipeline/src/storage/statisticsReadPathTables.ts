import type { SqliteTable } from "@uk-data-atlas/artifacts";
import type {
	StatisticsReadPath,
	StatisticsSelector,
	StatisticsTableSelector,
} from "@uk-data-atlas/measures";

/** The validated selectors, split into queryable fields and ordered child rows. */
export function statisticsReadPathTables(
	plan: StatisticsReadPath,
): Record<string, SqliteTable> {
	const selectors = Object.entries(plan.statistics);
	const regular = selectors.filter(
		(entry): entry is [string, StatisticsSelector] => !("kind" in entry[1]),
	);
	const tables = selectors.filter(
		(entry): entry is [string, StatisticsTableSelector] =>
			"kind" in entry[1],
	);
	return {
		statistics_read_path: {
			strict: true,
			columns: [
				"schema_version INTEGER NOT NULL",
				"data_catalog_hash TEXT NOT NULL",
			],
			rows: [[plan.schemaVersion, plan.dataCatalogHash]],
		},
		statistics_selector: {
			strict: true,
			columns: [
				"artifact TEXT NOT NULL",
				"kind TEXT NOT NULL CHECK (kind IN ('series','measure-table'))",
				"dataset TEXT NOT NULL",
				"geography TEXT NOT NULL",
				"measure TEXT",
				"absent_as_zero INTEGER",
				"status TEXT",
				"contest TEXT",
				"ratio_measure TEXT",
				"ratio_scale REAL",
				"ratio_scale_quotient INTEGER",
				"ratio_dataset TEXT",
				"ratio_period TEXT",
				"ratio_denominator_divisor REAL",
				"half_width_measure TEXT",
				"half_width_digits INTEGER",
				"table_id TEXT",
				"boundary_year INTEGER",
				"period TEXT",
			],
			key: ["artifact"],
			rows: selectors.map(([name, s]) =>
				"kind" in s
					? [
							name,
							s.kind,
							s.datasetId,
							s.geography,
							null,
							null,
							null,
							null,
							null,
							null,
							null,
							null,
							null,
							null,
							null,
							null,
							s.id,
							s.boundaryYear,
							s.period,
						]
					: [
							name,
							"series",
							s.datasetId,
							s.geography,
							s.measure,
							s.absentAsZero ? 1 : null,
							s.status ?? null,
							s.contest ?? null,
							s.ratio?.measure ?? null,
							s.ratio?.scale ?? null,
							s.ratio?.scaleQuotient ? 1 : null,
							s.ratio?.datasetId ?? null,
							s.ratio?.period ?? null,
							s.ratio?.denominatorDivisor ?? null,
							s.halfWidth?.measure ?? null,
							s.halfWidth?.digits ?? null,
							null,
							null,
							null,
						],
			),
		},
		statistics_selector_member: {
			strict: true,
			columns: [
				"artifact TEXT NOT NULL REFERENCES statistics_selector(artifact)",
				"role TEXT NOT NULL CHECK (role IN ('series','ratio'))",
				"dimension TEXT NOT NULL",
				"member TEXT NOT NULL",
			],
			key: ["artifact", "role", "dimension"],
			rows: regular.flatMap(([name, s]) => [
				...Object.entries(s.dimensions).map(([d, m]) => [
					name,
					"series",
					d,
					m,
				]),
				...Object.entries(s.ratio?.dimensions ?? {}).map(([d, m]) => [
					name,
					"ratio",
					d,
					m,
				]),
			]),
		},
		statistics_selector_option: {
			strict: true,
			columns: [
				"artifact TEXT NOT NULL REFERENCES statistics_selector(artifact)",
				"option TEXT NOT NULL CHECK (option IN ('sum','areas_in','plus','served_codes','ratio_dimensions'))",
			],
			key: ["artifact", "option"],
			rows: regular.flatMap(([name, selector]) => [
				...(selector.sum === undefined ? [] : [[name, "sum"]]),
				...(selector.areasIn === undefined ? [] : [[name, "areas_in"]]),
				...(selector.plus === undefined ? [] : [[name, "plus"]]),
				...(selector.servedCodes === undefined
					? []
					: [[name, "served_codes"]]),
				...(selector.ratio?.dimensions === undefined
					? []
					: [[name, "ratio_dimensions"]]),
			]),
		},
		statistics_selector_list: {
			strict: true,
			columns: [
				"artifact TEXT NOT NULL REFERENCES statistics_selector(artifact)",
				"role TEXT NOT NULL CHECK (role IN ('sum','areas_in','plus','table_measure'))",
				"position INTEGER NOT NULL",
				"value TEXT NOT NULL",
			],
			key: ["artifact", "role", "position"],
			rows: [
				...regular.flatMap(([name, s]) =>
					(
						[
							["sum", s.sum],
							["areas_in", s.areasIn],
							["plus", s.plus],
						] as const
					).flatMap(([role, values]) =>
						(values ?? []).map((value, i) => [
							name,
							role,
							i,
							value,
						]),
					),
				),
				...tables.flatMap(([name, s]) =>
					s.measures.map((value, i) => [
						name,
						"table_measure",
						i,
						value,
					]),
				),
			],
		},
		statistics_selector_code: {
			strict: true,
			columns: [
				"artifact TEXT NOT NULL REFERENCES statistics_selector(artifact)",
				"stored_code TEXT NOT NULL",
				"area_code TEXT NOT NULL",
				"source_area_code TEXT",
			],
			key: ["artifact", "stored_code"],
			rows: regular.flatMap(([name, s]) =>
				Object.entries(s.servedCodes ?? {}).map(([code, v]) => [
					name,
					code,
					v.areaCode,
					v.sourceAreaCode ?? null,
				]),
			),
		},
		statistics_selector_column: {
			strict: true,
			columns: [
				"artifact TEXT NOT NULL REFERENCES statistics_selector(artifact)",
				"position INTEGER NOT NULL",
				"measure TEXT NOT NULL",
			],
			key: ["artifact", "position"],
			rows: tables.flatMap(([name, s]) =>
				s.columns.map((column, i) => [name, i, column.measure]),
			),
		},
		statistics_selector_column_member: {
			strict: true,
			columns: [
				"artifact TEXT NOT NULL",
				"position INTEGER NOT NULL",
				"dimension TEXT NOT NULL",
				"member TEXT NOT NULL",
			],
			key: ["artifact", "position", "dimension"],
			constraints: [
				"FOREIGN KEY (artifact, position) REFERENCES statistics_selector_column(artifact, position)",
			],
			rows: tables.flatMap(([name, s]) =>
				s.columns.flatMap((column, i) =>
					Object.entries(column.dimensions).map(([d, m]) => [
						name,
						i,
						d,
						m,
					]),
				),
			),
		},
		statistics_observation_fallback: {
			strict: true,
			columns: ["artifact TEXT NOT NULL", "reason TEXT NOT NULL"],
			key: ["artifact"],
			rows: Object.entries(plan.observations),
		},
	};
}
