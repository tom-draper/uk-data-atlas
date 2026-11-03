import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { SqliteTable } from "@uk-data-atlas/artifacts";

import {
	AREA_RELATIONSHIPS,
	STATUSES,
	CONTEST_COLUMNS,
	CANDIDACY_COLUMNS,
	type StatisticsInput,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { createStatisticsAreaLookup } from "./statisticsAreaLookup";
import { registerStatistics, sourceKey } from "./statisticsRegistry";

export function statisticsTables(
	inputs: readonly StatisticsInput[],
): Record<string, SqliteTable> {
	const { releasePosition, area, areaIndex } = createStatisticsAreaLookup();

	let prepared: ReturnType<typeof registerStatistics> | undefined;
	/** Datasets and their registries, built once the area tables exist. */
	const prepare = (database: DatabaseSync) => {
		if (!prepared) {
			const index = areaIndex(database);
			prepared = registerStatistics(
				inputs.map((input) =>
					typeof input === "function" ? input(index) : input,
				),
			);
		}
		return prepared;
	};
	const statusIds = new Map<string, number>(
		STATUSES.map(([slug], index) => [slug, index + 1]),
	);
	/** Rows of one table, from the prepared registries. */
	const rows = (
		build: (
			state: ReturnType<typeof registerStatistics>,
			database: DatabaseSync,
		) => Iterable<SQLInputValue[]>,
	) =>
		function* (database: DatabaseSync): Generator<SQLInputValue[]> {
			yield* build(prepare(database), database);
		};

	return {
		source: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"publisher TEXT NOT NULL",
				"url TEXT",
				"licence TEXT NOT NULL",
				"licence_url TEXT",
				"citation TEXT",
			],
			key: ["id"],
			rows: rows(({ sources }) =>
				sources.items.map((source, index) => [
					index + 1,
					source.publisher,
					source.url ?? null,
					source.licence,
					source.licenceUrl ?? null,
					source.citation ?? null,
				]),
			),
		},
		dataset: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"slug TEXT NOT NULL UNIQUE",
				"title TEXT NOT NULL",
				"description TEXT NOT NULL",
				"source_id INTEGER NOT NULL REFERENCES source(id)",
				"released TEXT",
				"fingerprint TEXT NOT NULL",
			],
			key: ["id"],
			rows: rows(({ datasets, sources }) =>
				datasets.map((dataset, index) => [
					index + 1,
					dataset.slug,
					dataset.title,
					dataset.description,
					sources.id(sourceKey(dataset.source), dataset.slug),
					dataset.released ?? null,
					dataset.fingerprint,
				]),
			),
		},
		measure: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"slug TEXT NOT NULL UNIQUE",
				"label TEXT NOT NULL",
				"description TEXT NOT NULL",
				"unit TEXT NOT NULL",
				"value_kind TEXT NOT NULL CHECK (value_kind IN ('count','rate','share','median','mean','index','rank','amount','category'))",
				"aggregation TEXT NOT NULL CHECK (aggregation IN ('sum','ratio','weighted_mean','none'))",
				"numerator_id INTEGER REFERENCES measure(id)",
				"denominator_id INTEGER REFERENCES measure(id)",
			],
			key: ["id"],
			constraints: [
				"CHECK ((aggregation = 'ratio') = (numerator_id IS NOT NULL AND denominator_id IS NOT NULL))",
			],
			rows: rows(({ measures }) =>
				measures.items.map((measure, index) => [
					index + 1,
					measure.slug,
					measure.label,
					measure.description,
					measure.unit,
					measure.valueKind,
					measure.aggregation,
					measure.numerator === undefined
						? null
						: measures.id(measure.numerator, measure.slug),
					measure.denominator === undefined
						? null
						: measures.id(measure.denominator, measure.slug),
				]),
			),
		},
		dimension: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"slug TEXT NOT NULL UNIQUE",
				"label TEXT NOT NULL",
			],
			key: ["id"],
			rows: rows(({ dimensions }) =>
				dimensions.items.map((dimension, index) => [
					index + 1,
					dimension.slug,
					dimension.label,
				]),
			),
		},
		dimension_member: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"dimension_id INTEGER NOT NULL REFERENCES dimension(id)",
				"code TEXT NOT NULL",
				"label TEXT NOT NULL",
				"parent_id INTEGER REFERENCES dimension_member(id)",
				"position INTEGER NOT NULL",
			],
			key: ["id"],
			constraints: ["UNIQUE (dimension_id, code)"],
			rows: rows(({ members }) =>
				members.items.map((member, index) => [
					index + 1,
					member.dimension,
					member.code,
					member.label,
					member.parent,
					member.position,
				]),
			),
		},
		period: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"label TEXT NOT NULL UNIQUE",
				"kind TEXT NOT NULL CHECK (kind IN ('year','financial_year','academic_year','quarter','month','date','range'))",
				"start_date TEXT NOT NULL",
				"end_date TEXT NOT NULL",
			],
			key: ["id"],
			constraints: ["CHECK (start_date <= end_date)"],
			rows: rows(({ periods }) =>
				periods.items.map((period, index) => [
					index + 1,
					period.label,
					period.kind,
					period.start,
					period.end,
				]),
			),
		},
		status: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"slug TEXT NOT NULL UNIQUE",
				"label TEXT NOT NULL",
			],
			key: ["id"],
			rows: STATUSES.map(([slug, label], index) => [
				index + 1,
				slug,
				label,
			]),
		},
		series: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"dataset_id INTEGER NOT NULL REFERENCES dataset(id)",
				"measure_id INTEGER NOT NULL REFERENCES measure(id)",
				"release_id INTEGER NOT NULL REFERENCES area_releases(position)",
				"method TEXT NOT NULL CHECK (method IN ('published','converted','aggregated','modelled'))",
				"derived_from_id INTEGER REFERENCES series(id)",
				"key TEXT NOT NULL UNIQUE",
			],
			key: ["id"],
			constraints: [
				"CHECK ((method = 'published') = (derived_from_id IS NULL))",
			],
			indexes: [
				{
					name: "series_dataset",
					columns: ["dataset_id", "measure_id"],
				},
			],
			rows: rows(function* (
				{ seriesRows, seriesIds, measures },
				database,
			) {
				for (const [index, row] of seriesRows.entries()) {
					const ids = seriesIds[row.dataset - 1];
					yield [
						index + 1,
						row.dataset,
						measures.id(row.series.measure, row.key),
						releasePosition(database, row.series.release),
						row.series.method ?? "published",
						row.series.derivedFrom === undefined
							? null
							: ids[row.series.derivedFrom],
						row.key,
					];
				}
			}),
		},
		series_member: {
			strict: true,
			columns: [
				"series_id INTEGER NOT NULL REFERENCES series(id)",
				"dimension_id INTEGER NOT NULL REFERENCES dimension(id)",
				"member_id INTEGER NOT NULL REFERENCES dimension_member(id)",
			],
			key: ["series_id", "dimension_id"],
			indexes: [
				{
					name: "series_member_member",
					columns: ["member_id", "series_id"],
				},
			],
			rows: rows(({ seriesRows, dimensions, members }) =>
				seriesRows.flatMap((row, index) =>
					Object.entries(row.series.members ?? {}).map(
						([dimension, member]) => [
							index + 1,
							dimensions.id(dimension, row.key),
							members.id(`${dimension}\0${member}`, row.key),
						],
					),
				),
			),
		},
		dataset_area_name: {
			strict: true,
			columns: [
				"dataset_id INTEGER NOT NULL REFERENCES dataset(id)",
				"area_version_id INTEGER NOT NULL REFERENCES area_version(id)",
				"name TEXT NOT NULL",
			],
			key: ["dataset_id", "area_version_id"],
			rows: rows(function* ({ datasets }, database) {
				for (const [index, dataset] of datasets.entries()) {
					const seen = new Set<number>();
					for (const {
						release,
						code,
						name,
					} of dataset.areaNames?.() ?? []) {
						const found = area(
							database,
							dataset.slug,
							release,
							code,
						);
						if (seen.has(found.id))
							throw new Error(
								`Duplicate area name ${code} for dataset ${dataset.slug}`,
							);
						seen.add(found.id);
						if (found.name !== name)
							yield [index + 1, found.id, name];
					}
				}
			}),
		},
		dataset_area_key: {
			strict: true,
			columns: [
				"dataset_id INTEGER NOT NULL REFERENCES dataset(id)",
				"area_version_id INTEGER NOT NULL REFERENCES area_version(id)",
				"key TEXT NOT NULL",
			],
			key: ["dataset_id", "area_version_id"],
			rows: rows(function* ({ datasets }, database) {
				for (const [index, dataset] of datasets.entries())
					for (const { release, code, key } of dataset.areaKeys?.() ??
						[])
						yield [
							index + 1,
							area(database, dataset.slug, release, code).id,
							key,
						];
			}),
		},
		area_relationship: {
			strict: true,
			columns: [
				"dataset_id INTEGER NOT NULL REFERENCES dataset(id)",
				`relation TEXT NOT NULL CHECK (relation IN (${AREA_RELATIONSHIPS.map((name) => `'${name}'`).join(",")}))`,
				"child_version_id INTEGER NOT NULL REFERENCES area_version(id)",
				"parent_version_id INTEGER NOT NULL REFERENCES area_version(id)",
			],
			key: [
				"dataset_id",
				"relation",
				"child_version_id",
				"parent_version_id",
			],
			rows: rows(function* ({ datasets }, database) {
				for (const [index, dataset] of datasets.entries())
					for (const {
						relation,
						child,
						parent,
					} of dataset.relationships?.() ?? [])
						yield [
							index + 1,
							relation,
							area(
								database,
								dataset.slug,
								child.release,
								child.code,
							).id,
							area(
								database,
								dataset.slug,
								parent.release,
								parent.code,
							).id,
						];
			}),
		},
		observation: {
			strict: true,
			columns: [
				"series_id INTEGER NOT NULL REFERENCES series(id)",
				"area_version_id INTEGER NOT NULL REFERENCES area_version(id)",
				"period_id INTEGER NOT NULL REFERENCES period(id)",
				"value REAL",
				"status_id INTEGER NOT NULL DEFAULT 1 REFERENCES status(id)",
				"lower REAL",
				"upper REAL",
				"category_id INTEGER REFERENCES dimension_member(id)",
			],
			key: ["series_id", "area_version_id", "period_id"],
			constraints: [
				"CHECK (value IS NOT NULL OR category_id IS NOT NULL OR status_id <> 1)",
			],
			indexes: [
				{
					name: "observation_area",
					columns: ["area_version_id", "series_id", "period_id"],
				},
			],
			rows: rows(function* (
				{ datasets, seriesIds, periods, category },
				database,
			) {
				for (const [index, dataset] of datasets.entries()) {
					const ids = seriesIds[index];
					for (const observation of dataset.observations()) {
						const series = dataset.series[observation.series];
						if (!series)
							throw new Error(
								`Unknown series ${observation.series} in dataset ${dataset.slug}`,
							);
						const status = statusIds.get(
							observation.status ?? "observed",
						);
						if (status === undefined)
							throw new Error(
								`Unknown status ${observation.status} in dataset ${dataset.slug}`,
							);
						if (
							observation.value !== null &&
							!Number.isFinite(observation.value)
						)
							throw new Error(
								`Non-finite value for ${observation.code} in dataset ${dataset.slug}`,
							);
						yield [
							ids[observation.series],
							area(
								database,
								dataset.slug,
								series.release,
								observation.code,
							).id,
							periods.id(observation.period, dataset.slug),
							observation.value,
							status,
							observation.lower ?? null,
							observation.upper ?? null,
							category(dataset, observation.category),
						];
					}
				}
				const mismatched = database
					.prepare(
						"SELECT count(*) AS n FROM observation o JOIN series s ON s.id = o.series_id JOIN area_version v ON v.id = o.area_version_id WHERE v.release_id <> s.release_id",
					)
					.get();
				if (Number(mismatched?.n) !== 0)
					throw new Error(
						"Observations outside their series' release",
					);
			}),
			views: {
				v_observation: `
SELECT d.slug AS dataset, m.slug AS measure, m.unit,
  (SELECT group_concat(dim.slug || '=' || dm.code, '; ')
   FROM series_member sm JOIN dimension dim ON dim.id = sm.dimension_id
   JOIN dimension_member dm ON dm.id = sm.member_id
   WHERE sm.series_id = s.id) AS members,
  a.code AS area_code, coalesce(n.name, v.name) AS area_name,
  r.geography, r.id AS release, p.label AS period,
  o.value, o.lower, o.upper, c.code AS category, st.slug AS status,
  s.method, src.licence
FROM observation o
JOIN series s ON s.id = o.series_id
JOIN dataset d ON d.id = s.dataset_id
JOIN source src ON src.id = d.source_id
JOIN measure m ON m.id = s.measure_id
JOIN area_version v ON v.id = o.area_version_id
JOIN area a ON a.id = v.area_id
JOIN area_releases r ON r.position = s.release_id
JOIN period p ON p.id = o.period_id
JOIN status st ON st.id = o.status_id
LEFT JOIN dimension_member c ON c.id = o.category_id
LEFT JOIN dataset_area_name n ON n.dataset_id = d.id AND n.area_version_id = v.id`,
			},
		},
		dataset_part: {
			strict: true,
			columns: [
				"dataset_id INTEGER NOT NULL REFERENCES dataset(id)",
				"position INTEGER NOT NULL",
				"key TEXT NOT NULL",
				"header TEXT NOT NULL",
			],
			key: ["dataset_id", "position"],
			constraints: ["UNIQUE (dataset_id, key)"],
			rows: rows(function* ({ datasets }) {
				for (const [index, dataset] of datasets.entries())
					for (const [position, layout] of [
						...(dataset.layouts?.() ?? []),
					].entries())
						yield [index + 1, position, layout.key, layout.header];
			}),
		},
		dataset_leaf: {
			strict: true,
			columns: [
				"dataset_id INTEGER NOT NULL",
				"part INTEGER NOT NULL",
				"records TEXT NOT NULL",
				"position INTEGER NOT NULL",
				"path TEXT NOT NULL",
				"kind TEXT NOT NULL CHECK (kind IN ('value','lower','upper','code','name','parent_code','parent_name','derived','literal','status','contest','candidacy'))",
				"series_id INTEGER REFERENCES series(id)",
				"period_id INTEGER REFERENCES period(id)",
				"rule TEXT",
				"literal TEXT",
				"parent INTEGER",
				"field TEXT",
			],
			key: ["dataset_id", "part", "records", "position"],
			constraints: [
				"FOREIGN KEY (dataset_id, part) REFERENCES dataset_part(dataset_id, position)",
				"CHECK ((kind IN ('value','lower','upper','status')) = (series_id IS NOT NULL AND period_id IS NOT NULL))",
				"CHECK ((kind = 'derived') = (rule IS NOT NULL))",
				"CHECK ((kind IN ('literal','status')) = (literal IS NOT NULL))",
				"CHECK ((kind IN ('parent_code','parent_name')) = (parent IS NOT NULL))",
				"CHECK ((kind IN ('contest','candidacy')) = (field IS NOT NULL))",
			],
			rows: rows(function* ({ datasets, seriesIds, periods }, database) {
				for (const [index, dataset] of datasets.entries()) {
					const ids = seriesIds[index];
					for (const [part, layout] of [
						...(dataset.layouts?.() ?? []),
					].entries())
						for (const { from, leaves } of layout.records)
							for (const [position, leaf] of leaves.entries()) {
								const value =
									leaf.kind === "value" ||
									leaf.kind === "lower" ||
									leaf.kind === "upper" ||
									leaf.kind === "status";
								if (value && ids[leaf.series] === undefined)
									throw new Error(
										`Unknown series ${leaf.series} in ${dataset.slug} layout`,
									);
								yield [
									index + 1,
									part,
									from,
									position,
									JSON.stringify(leaf.path),
									leaf.kind,
									value ? ids[leaf.series] : null,
									value
										? periods.id(leaf.period, dataset.slug)
										: null,
									leaf.kind === "derived" ? leaf.rule : null,
									leaf.kind === "literal"
										? leaf.value
										: leaf.kind === "status"
											? leaf.statuses
											: null,
									leaf.kind === "parent_code" ||
									leaf.kind === "parent_name"
										? leaf.parent
										: null,
									leaf.kind === "contest" ||
									leaf.kind === "candidacy"
										? leaf.column
										: null,
								];
							}
				}
			}),
		},
		dataset_record: {
			strict: true,
			columns: [
				"dataset_id INTEGER NOT NULL",
				"part INTEGER NOT NULL",
				"records TEXT NOT NULL",
				"position INTEGER NOT NULL",
				"area_version_id INTEGER NOT NULL REFERENCES area_version(id)",
			],
			key: ["dataset_id", "part", "records", "position"],
			constraints: [
				"FOREIGN KEY (dataset_id, part) REFERENCES dataset_part(dataset_id, position)",
			],
			rows: rows(function* ({ datasets }, database) {
				for (const [index, dataset] of datasets.entries())
					for (const [part, layout] of [
						...(dataset.layouts?.() ?? []),
					].entries())
						for (const { from, areas } of layout.records)
							for (const [
								position,
								{ release, code },
							] of areas.entries())
								yield [
									index + 1,
									part,
									from,
									position,
									area(database, dataset.slug, release, code)
										.id,
								];
			}),
		},
		dataset_record_parent: {
			strict: true,
			columns: [
				"dataset_id INTEGER NOT NULL",
				"part INTEGER NOT NULL",
				"records TEXT NOT NULL",
				"position INTEGER NOT NULL",
				"parent INTEGER NOT NULL",
				"area_version_id INTEGER NOT NULL REFERENCES area_version(id)",
			],
			key: ["dataset_id", "part", "records", "position", "parent"],
			constraints: [
				"FOREIGN KEY (dataset_id, part, records, position) REFERENCES dataset_record(dataset_id, part, records, position)",
			],
			rows: rows(function* ({ datasets }, database) {
				for (const [index, dataset] of datasets.entries())
					for (const [part, layout] of [
						...(dataset.layouts?.() ?? []),
					].entries())
						for (const { from, areas } of layout.records)
							for (const [
								position,
								{ parents },
							] of areas.entries())
								for (const [parent, found] of (
									parents ?? []
								).entries())
									if (found)
										yield [
											index + 1,
											part,
											from,
											position,
											parent,
											area(
												database,
												dataset.slug,
												found.release,
												found.code,
											).id,
										];
			}),
		},
		election: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"dataset_id INTEGER NOT NULL",
				"part INTEGER NOT NULL",
				"kind TEXT NOT NULL CHECK (kind IN ('general','local'))",
				"date TEXT NOT NULL",
				"release_id INTEGER NOT NULL REFERENCES area_releases(position)",
			],
			key: ["id"],
			constraints: [
				"UNIQUE (dataset_id, part)",
				"FOREIGN KEY (dataset_id, part) REFERENCES dataset_part(dataset_id, position)",
			],
			rows: rows(function* ({ datasets }, database) {
				let id = 0;
				for (const [index, dataset] of datasets.entries())
					for (const [part, { election }] of [
						...(dataset.layouts?.() ?? []),
					].entries())
						if (election)
							yield [
								++id,
								index + 1,
								part,
								election.kind,
								election.date,
								releasePosition(database, election.release),
							];
			}),
		},
		contest: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"election_id INTEGER NOT NULL REFERENCES election(id)",
				"area_version_id INTEGER NOT NULL REFERENCES area_version(id)",
				...CONTEST_COLUMNS.map((column) => `${column} TEXT`),
			],
			key: ["id"],
			constraints: ["UNIQUE (election_id, area_version_id)"],
			rows: rows(function* ({ datasets }, database) {
				let election = 0;
				let id = 0;
				for (const [index, dataset] of datasets.entries())
					for (const layout of dataset.layouts?.() ?? []) {
						if (!layout.election) continue;
						election++;
						for (const { areas } of layout.records)
							for (const { release, code, contest } of areas)
								yield [
									++id,
									election,
									area(database, dataset.slug, release, code)
										.id,
									...CONTEST_COLUMNS.map(
										(column) => contest?.[column] ?? null,
									),
								];
					}
			}),
		},
		candidacy: {
			strict: true,
			columns: [
				"contest_id INTEGER NOT NULL REFERENCES contest(id)",
				"position INTEGER NOT NULL",
				...CANDIDACY_COLUMNS.map((column) => `${column} TEXT`),
				"elected INTEGER NOT NULL CHECK (elected IN (0,1))",
			],
			key: ["contest_id", "position"],
			rows: rows(function* ({ datasets }) {
				let id = 0;
				for (const dataset of datasets)
					for (const layout of dataset.layouts?.() ?? []) {
						if (!layout.election) continue;
						for (const { areas } of layout.records)
							for (const { elected } of areas) {
								id++;
								if (elected)
									yield [
										id,
										1,
										...CANDIDACY_COLUMNS.map(
											(column) => elected[column] ?? null,
										),
										1,
									];
							}
					}
			}),
		},
		dataset_record_absent: {
			strict: true,
			columns: [
				"dataset_id INTEGER NOT NULL",
				"part INTEGER NOT NULL",
				"records TEXT NOT NULL",
				"position INTEGER NOT NULL",
				"leaf INTEGER NOT NULL",
			],
			key: ["dataset_id", "part", "records", "position", "leaf"],
			constraints: [
				"FOREIGN KEY (dataset_id, part, records, position) REFERENCES dataset_record(dataset_id, part, records, position)",
				"FOREIGN KEY (dataset_id, part, records, leaf) REFERENCES dataset_leaf(dataset_id, part, records, position)",
			],
			rows: rows(function* ({ datasets }, database) {
				for (const [index, dataset] of datasets.entries())
					for (const [part, layout] of [
						...(dataset.layouts?.() ?? []),
					].entries())
						for (const { from, areas } of layout.records)
							for (const [
								position,
								{ absent },
							] of areas.entries())
								for (const leaf of absent ?? [])
									yield [
										index + 1,
										part,
										from,
										position,
										leaf,
									];
				// Last statistics table: every row, layouts included, is written.
				for (const dataset of datasets) dataset.verify?.(database);
			}),
		},
	};
}
