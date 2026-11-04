import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { SqliteTable } from "@uk-data-atlas/artifacts";

import {
	AREA_RELATIONSHIPS,
	STATUSES,
	CONTEST_COLUMNS,
	CANDIDACY_COLUMNS,
	type StatisticsInput,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { createStatisticsAreaLookup } from "./statisticsAreaLookup.ts";
import { collectParties } from "./statisticsParties.ts";
import { registerStatistics, sourceKey } from "./statisticsRegistry.ts";

/** The contest columns stored as the publisher's text. */
const CONTEST_TEXT_COLUMNS = CONTEST_COLUMNS.filter(
	(column) =>
		column !== "region" &&
		column !== "country" &&
		column !== "first_party" &&
		column !== "second_party" &&
		column !== "winner",
);

export function statisticsTables(
	inputs: readonly StatisticsInput[],
): Record<string, SqliteTable> {
	const { releasePosition, area, areaIndex, namedArea } =
		createStatisticsAreaLookup();
	const periodId = (
		database: DatabaseSync,
		dataset: string,
		label: string,
	) => {
		const row = database
			.prepare("SELECT id FROM period WHERE label = ?")
			.get(label);
		if (!row)
			throw new Error(
				`Dataset ${dataset} relates areas for period ${label}, which it has no observation in`,
			);
		return Number(row.id);
	};

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
	let collected: ReturnType<typeof collectParties> | undefined;
	const parties = (database: DatabaseSync) =>
		(collected ??= collectParties(prepare(database).datasets));
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
				"period_id INTEGER NOT NULL REFERENCES period(id)",
				"child_version_id INTEGER NOT NULL REFERENCES area_version(id)",
				"parent_version_id INTEGER NOT NULL REFERENCES area_version(id)",
			],
			key: [
				"dataset_id",
				"relation",
				"period_id",
				"child_version_id",
				"parent_version_id",
			],
			rows: rows(function* ({ datasets }, database) {
				for (const [index, dataset] of datasets.entries())
					for (const {
						relation,
						period,
						child,
						parent,
					} of dataset.relationships?.() ?? [])
						yield [
							index + 1,
							relation,
							periodId(database, dataset.slug, period),
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
		election: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"dataset_id INTEGER NOT NULL REFERENCES dataset(id)",
				"label TEXT NOT NULL",
				"kind TEXT NOT NULL CHECK (kind IN ('general','local'))",
				"date TEXT NOT NULL",
				"release_id INTEGER NOT NULL REFERENCES area_releases(position)",
			],
			key: ["id"],
			constraints: [
				"UNIQUE (dataset_id, label)",
				"UNIQUE (dataset_id, date)",
			],
			rows: rows(function* ({ datasets }, database) {
				let id = 0;
				for (const [index, dataset] of datasets.entries())
					for (const election of dataset.elections?.() ?? [])
						yield [
							++id,
							index + 1,
							election.label,
							election.kind,
							election.date,
							releasePosition(database, election.release),
						];
			}),
		},
		party: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"code TEXT NOT NULL UNIQUE",
				"key TEXT NOT NULL UNIQUE",
				"name TEXT NOT NULL",
				"colour TEXT",
			],
			key: ["id"],
			rows: (database) =>
				parties(database).rows.map((party) => [
					party.id,
					party.code,
					party.key,
					party.name,
					party.colour,
				]),
		},
		contest: {
			strict: true,
			rowid: true,
			columns: [
				"id INTEGER NOT NULL",
				"election_id INTEGER NOT NULL REFERENCES election(id)",
				"area_version_id INTEGER NOT NULL REFERENCES area_version(id)",
				...CONTEST_TEXT_COLUMNS.map((column) => `${column} TEXT`),
				"region_text TEXT",
				"country_text TEXT",
				"region_area_version_id INTEGER REFERENCES area_version(id)",
				"country_area_version_id INTEGER REFERENCES area_version(id)",
				"first_party_id INTEGER REFERENCES party(id)",
				"second_party_id INTEGER REFERENCES party(id)",
				"winner_party_id INTEGER REFERENCES party(id)",
			],
			key: ["id"],
			constraints: [
				"UNIQUE (election_id, area_version_id)",
				// A name is stored as text only where it names no held area.
				"CHECK (region_text IS NULL OR region_area_version_id IS NULL)",
				"CHECK (country_text IS NULL OR country_area_version_id IS NULL)",
			],
			rows: rows(function* ({ datasets }, database) {
				const { idOfCode, idOfKey } = parties(database);
				let election = 0;
				let id = 0;
				for (const dataset of datasets)
					for (const { date, contests } of dataset.elections?.() ??
						[]) {
						election++;
						const year = Number(date.slice(0, 4));
						for (const { release, code, contest } of contests) {
							/** The area a name is, else the name as text. */
							const named = (column: "region" | "country") => {
								const text = contest?.[column] ?? null;
								const geography =
									dataset.contestAreas?.[column];
								const found =
									text !== null && geography
										? namedArea(
												database,
												geography,
												year,
												text,
											)
										: undefined;
								return found === undefined
									? { id: null, text }
									: { id: found, text: null };
							};
							const region = named("region");
							const country = named("country");
							yield [
								++id,
								election,
								area(database, dataset.slug, release, code).id,
								...CONTEST_TEXT_COLUMNS.map(
									(column) => contest?.[column] ?? null,
								),
								region.text,
								country.text,
								region.id,
								country.id,
								contest?.first_party
									? idOfCode(contest.first_party)
									: null,
								contest?.second_party
									? idOfCode(contest.second_party)
									: null,
								contest?.winner
									? idOfKey(contest.winner)
									: null,
							];
						}
					}
			}),
			views: {
				v_contest: `
SELECT c.id AS contest_id, d.slug AS dataset, e.label AS election, e.kind, e.date AS polling_day,
  a.code AS area_code, c.area_name, r.geography, r.id AS release,
  c.authority_code, c.authority_name, coalesce(rv.name, c.region_text) AS region,
  coalesce(cv.name, c.country_text) AS country, c.constituency_type, c.result,
  fp.code AS first_party, sp.code AS second_party, wp.key AS winner,
  e.dataset_id, c.area_version_id
FROM contest c
JOIN election e ON e.id = c.election_id
JOIN dataset d ON d.id = e.dataset_id
JOIN area_version v ON v.id = c.area_version_id
JOIN area a ON a.id = v.area_id
JOIN area_releases r ON r.position = v.release_id
LEFT JOIN area_version rv ON rv.id = c.region_area_version_id
LEFT JOIN area_version cv ON cv.id = c.country_area_version_id
LEFT JOIN party fp ON fp.id = c.first_party_id
LEFT JOIN party sp ON sp.id = c.second_party_id
LEFT JOIN party wp ON wp.id = c.winner_party_id`,
			},
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
			views: {
				// A candidate's party votes are the party's observation in the contest.
				v_candidacy: `
SELECT *, 100.0 * party_votes / valid_votes AS party_vote_share FROM (
  SELECT k.contest_id, k.position, k.given_name, k.family_name, k.gender, k.elected,
    c.dataset, c.election, c.polling_day, c.area_code, c.area_name,
    p.code AS party, p.name AS party_name,
    (SELECT o.value FROM observation o
     JOIN series s ON s.id = o.series_id
     JOIN measure m ON m.id = s.measure_id AND m.slug = 'party-votes'
     JOIN series_member sm ON sm.series_id = s.id
     JOIN dimension dim ON dim.id = sm.dimension_id AND dim.slug = 'party'
     JOIN dimension_member dm ON dm.id = sm.member_id AND dm.code = lower(p.key)
     WHERE s.dataset_id = c.dataset_id AND o.area_version_id = c.area_version_id
       AND o.period_id = (SELECT id FROM period WHERE label = c.polling_day)) AS party_votes,
    (SELECT o.value FROM observation o
     JOIN series s ON s.id = o.series_id
     JOIN measure m ON m.id = s.measure_id AND m.slug = 'valid-votes'
     WHERE s.dataset_id = c.dataset_id AND o.area_version_id = c.area_version_id
       AND o.period_id = (SELECT id FROM period WHERE label = c.polling_day)) AS valid_votes
  FROM candidacy k
  JOIN v_contest c ON c.contest_id = k.contest_id
  JOIN contest ct ON ct.id = k.contest_id
  LEFT JOIN party p ON p.id = coalesce(ct.first_party_id, ct.winner_party_id))`,
			},
			rows: rows(function* ({ datasets }, database) {
				let id = 0;
				for (const dataset of datasets)
					for (const { contests } of dataset.elections?.() ?? [])
						for (const { elected } of contests) {
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
				// The last statistics table: every row is written.
				for (const dataset of datasets) dataset.verify?.(database);
			}),
		},
	};
}
