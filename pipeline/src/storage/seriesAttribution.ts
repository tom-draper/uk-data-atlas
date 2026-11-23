import type { DatabaseSync } from "node:sqlite";
import { parseModelInputRef } from "./modelInputRefs.ts";

/**
 * Where every series comes from, in one place: `series_source`,
 * `series_source_licence`, `series_notice`, `v_series_attribution` and
 * `v_series_terms`. Written at atlas assembly, after the notional series, the
 * crosswalk weight inputs and the licence tables are in, and before `ANALYZE`.
 *
 * A series depends on more than its dataset's source. The walk takes every
 * edge the release records, and writes the closure once so a query is a
 * lookup, and so a module that holds only some of the series still has the
 * sources of the series it holds:
 *
 * - `dataset`: `series.dataset_id`, then `dataset.source_id`.
 * - `boundaries`: the series' release, then `boundary_release_source`.
 * - `crosswalk`: `series_crosswalk`, then `crosswalk_provenance_source`.
 * - `crosswalk-weight`: those crosswalks' `crosswalk_weight_input`, then
 *   `crosswalk_input_source`.
 * - `input:value`, `input:weight`: `series_input` (and `derived_from_id` when
 *   it is not one), then everything the input series depends on.
 * - `model`: `series_model`, then the datasets and weight bases the model's
 *   `model_input` keys name (`dataset:<slug>`, `weights:<basis>`).
 * - `model-input`: the series a model's `model_input` keys name, and
 *   everything those depend on.
 *
 * `via` is the first edge from the series, `depth` the number of edges to the
 * source, and a source reached by more than one edge keeps the closest as
 * `via` and lists every edge in `vias`.
 *
 * Licences are not always the source's. A source can carry both a licence for
 * a range of years and another for the years before it (the local election
 * results), so `election_licence` decides which applies to the elections a
 * series holds, or, through a model's role dates, to the elections a model
 * read. A series that mixes both holds both.
 */

/** The ways a series reaches a source, closest first on a tie. */
export const ATTRIBUTION_VIAS = [
	"dataset",
	"input:value",
	"input:weight",
	"crosswalk",
	"crosswalk-weight",
	"boundaries",
	"model",
	"model-input",
] as const;

export type AttributionVia = (typeof ATTRIBUTION_VIAS)[number];

/**
 * Publishers whose boundary files carry Ordnance Survey data, which the Open
 * Geography Portal asks users to acknowledge with the statement below, and the
 * year it names. Other publishers' boundary files state no such term.
 */
const OS_BOUNDARY_PUBLISHERS: ReadonlySet<string> = new Set([
	"Office for National Statistics",
]);

const OS_NOTICE = "Contains OS data © Crown copyright and database right";

const osNotice = (year: number): string => `${OS_NOTICE} ${year}`;

const OS_YEAR = new RegExp(`^${OS_NOTICE} (\\d{4})$`);

/** "2019", "2019 and 2021", "2019, 2021 and 2024". */
const listYears = (years: readonly string[]): string =>
	years.length < 2
		? (years[0] ?? "")
		: `${years.slice(0, -1).join(", ")} and ${years.at(-1)}`;

/**
 * A series on several boundary files, or built from series on several, owes
 * one OS statement naming each year, not one for each year.
 */
const combineOsNotices = (
	notices: readonly (readonly [number, string])[],
): (readonly [number, string])[] => {
	const years = new Set<string>();
	let sourceId: number | undefined;
	const rest: (readonly [number, string])[] = [];
	for (const entry of notices) {
		const year = OS_YEAR.exec(entry[1])?.[1];
		if (year === undefined) {
			rest.push(entry);
			continue;
		}
		years.add(year);
		sourceId = Math.min(sourceId ?? entry[0], entry[0]);
	}
	if (sourceId === undefined) return rest;
	return [
		...rest,
		[sourceId, `${OS_NOTICE} ${listYears([...years].sort())}`],
	];
};

/** A model role that names the election a model input was read for. */
const ROLE_DATE = /^local election (\d{4}-\d{2}-\d{2})$/;

const TABLES = `
CREATE TABLE series_source (
	series_id INTEGER NOT NULL REFERENCES series(id),
	source_id INTEGER NOT NULL REFERENCES source(id),
	via TEXT NOT NULL CHECK (via IN (${ATTRIBUTION_VIAS.map((via) => `'${via}'`).join(", ")})),
	vias TEXT NOT NULL,
	depth INTEGER NOT NULL CHECK (depth >= 0),
	PRIMARY KEY (series_id, source_id)
) WITHOUT ROWID, STRICT;
CREATE TABLE series_source_licence (
	series_id INTEGER NOT NULL REFERENCES series(id),
	source_id INTEGER NOT NULL REFERENCES source(id),
	licence_id TEXT NOT NULL REFERENCES licence(id),
	PRIMARY KEY (series_id, source_id, licence_id)
) WITHOUT ROWID, STRICT;
CREATE TABLE series_notice (
	series_id INTEGER NOT NULL REFERENCES series(id),
	source_id INTEGER NOT NULL REFERENCES source(id),
	notice TEXT NOT NULL,
	PRIMARY KEY (series_id, source_id, notice)
) WITHOUT ROWID, STRICT;`;

/**
 * One row per series and source it depends on. A source with no licence on
 * record has no `commercial_use` and no `share_alike` (unknown), and a source
 * under several licences takes the least permissive: `commercial_use` is the
 * minimum, `share_alike` the maximum.
 */
export const ATTRIBUTION_VIEW = `
SELECT ss.series_id, s.key AS series, m.slug AS measure, s.method,
  ss.source_id, src.publisher, src.url, src.citation,
  (SELECT group_concat(licence_id, ', ') FROM (
     SELECT licence_id FROM series_source_licence
     WHERE series_id = ss.series_id AND source_id = ss.source_id
     ORDER BY licence_id)) AS licences,
  (SELECT CASE WHEN count(l.commercial_use) < count(*) OR count(*) = 0 THEN NULL
               ELSE min(l.commercial_use) END
   FROM series_source_licence sl JOIN licence l ON l.id = sl.licence_id
   WHERE sl.series_id = ss.series_id AND sl.source_id = ss.source_id) AS commercial_use,
  (SELECT CASE WHEN max(l.share_alike) = 1 THEN 1
               WHEN count(l.share_alike) < count(*) OR count(*) = 0 THEN NULL ELSE 0 END
   FROM series_source_licence sl JOIN licence l ON l.id = sl.licence_id
   WHERE sl.series_id = ss.series_id AND sl.source_id = ss.source_id) AS share_alike,
  ss.via, ss.vias, ss.depth
FROM series_source ss
JOIN series s ON s.id = ss.series_id
JOIN measure m ON m.id = s.measure_id
JOIN source src ON src.id = ss.source_id`;

/**
 * One row per series: how many sources, the licences it is under, whether it
 * may be used commercially (the minimum over its sources, unknown when any
 * source is), whether it is ShareAlike (the maximum, unknown when no source
 * is and any is unknown) and the text to print. The text names each publisher
 * once, then each licence's statement once, then the notices the sources and
 * boundary files ask for.
 */
export const TERMS_VIEW = `
SELECT s.id AS series_id, s.key AS series, m.slug AS measure, s.method,
  count(a.source_id) AS sources,
  (SELECT group_concat(licence_id, ', ') FROM (
     SELECT licence_id FROM series_source_licence WHERE series_id = s.id
     GROUP BY licence_id ORDER BY licence_id)) AS licences,
  CASE WHEN count(a.commercial_use) < count(a.source_id) THEN NULL ELSE min(a.commercial_use) END AS commercial_use,
  CASE WHEN max(a.share_alike) = 1 THEN 1
       WHEN count(a.share_alike) < count(a.source_id) THEN NULL ELSE 0 END AS share_alike,
  'Source: ' || coalesce((SELECT group_concat(publisher, '; ') FROM (
       SELECT src.publisher FROM series_source ss JOIN source src ON src.id = ss.source_id
       WHERE ss.series_id = s.id
         AND NOT EXISTS (SELECT 1 FROM series_source o JOIN source os ON os.id = o.source_id
           WHERE o.series_id = s.id AND os.publisher <> src.publisher
             AND substr(os.publisher, 1, length(src.publisher)) = src.publisher)
       GROUP BY src.publisher ORDER BY min(ss.depth), src.publisher)), 'unknown')
  || coalesce('. ' || (SELECT group_concat(attribution, '. ') FROM (
       SELECT l.attribution FROM series_source_licence sl JOIN licence l ON l.id = sl.licence_id
       WHERE sl.series_id = s.id GROUP BY l.attribution ORDER BY min(l.id))), '')
  || coalesce('. ' || (SELECT group_concat(notice, '. ') FROM (
       SELECT notice FROM series_notice WHERE series_id = s.id GROUP BY notice ORDER BY notice)), '')
  || '.' AS attribution
FROM series s
JOIN measure m ON m.id = s.measure_id
LEFT JOIN v_series_attribution a ON a.series_id = s.id
GROUP BY s.id`;

interface Reach {
	depth: number;
	/** The closest depth each edge reached the source at. */
	vias: Map<AttributionVia, number>;
	licences: Set<string>;
	notices: Set<string>;
}

type Closure = Map<number, Reach>;

const viaRank = (via: AttributionVia) => ATTRIBUTION_VIAS.indexOf(via);

const add = (
	closure: Closure,
	sourceId: number,
	depth: number,
	via: AttributionVia,
	licences: Iterable<string>,
	notices: Iterable<string>,
): void => {
	let reach = closure.get(sourceId);
	if (!reach) {
		reach = {
			depth,
			vias: new Map(),
			licences: new Set(),
			notices: new Set(),
		};
		closure.set(sourceId, reach);
	}
	reach.depth = Math.min(reach.depth, depth);
	reach.vias.set(via, Math.min(reach.vias.get(via) ?? depth, depth));
	for (const licence of licences) reach.licences.add(licence);
	for (const notice of notices) reach.notices.add(notice);
};

/** `child`'s sources, one edge further out and all reached by `via`. */
const merge = (
	into: Closure,
	child: Closure,
	via: AttributionVia,
	extra = 1,
): void => {
	for (const [sourceId, reach] of child)
		add(
			into,
			sourceId,
			reach.depth + extra,
			via,
			reach.licences,
			reach.notices,
		);
};

/** The closest via at the closest depth, ties going to the earlier in `ATTRIBUTION_VIAS`. */
const closest = (reach: Reach): AttributionVia =>
	[...reach.vias]
		.filter(([, depth]) => depth === reach.depth)
		.map(([via]) => via)
		.sort((a, b) => viaRank(a) - viaRank(b))[0]!;

interface SeriesRow {
	id: number;
	key: string;
	datasetId: number;
	releaseId: number;
	derivedFromId: number | null;
}

const group = <K, V>(rows: readonly [K, V][]): Map<K, V[]> => {
	const map = new Map<K, V[]>();
	for (const [key, value] of rows) {
		const list = map.get(key);
		if (list) list.push(value);
		else map.set(key, [value]);
	}
	return map;
};

const all = (database: DatabaseSync, sql: string) =>
	database.prepare(sql).all() as Record<string, unknown>[];

const optionalAll = (database: DatabaseSync, table: string, sql: string) =>
	database
		.prepare(
			"SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = ?",
		)
		.get(table)
		? all(database, sql)
		: [];

/** What the walk reads, loaded once. */
const readLineage = (database: DatabaseSync) => {
	const series = new Map<number, SeriesRow>();
	for (const row of all(
		database,
		"SELECT id, key, dataset_id, release_id, derived_from_id FROM series ORDER BY id",
	))
		series.set(row.id as number, {
			id: row.id as number,
			key: row.key as string,
			datasetId: row.dataset_id as number,
			releaseId: row.release_id as number,
			derivedFromId: (row.derived_from_id as number | null) ?? null,
		});
	const seriesByKey = new Map(
		[...series.values()].map((row) => [row.key, row.id]),
	);
	const datasets = new Map<number, { slug: string; sourceId: number }>();
	for (const row of all(database, "SELECT id, slug, source_id FROM dataset"))
		datasets.set(row.id as number, {
			slug: row.slug as string,
			sourceId: row.source_id as number,
		});
	const datasetBySlug = new Map(
		[...datasets].map(([id, row]) => [row.slug, id]),
	);
	const sources = new Map<number, { citation: string | null }>();
	for (const row of all(database, "SELECT id, citation FROM source"))
		sources.set(row.id as number, {
			citation: (row.citation as string | null) ?? null,
		});
	const sourceLicences = group(
		all(
			database,
			"SELECT source_id, licence_id FROM source_licence ORDER BY source_id, licence_id",
		).map((row) => [row.source_id as number, row.licence_id as string]),
	);
	const electionLicences = new Map<number, Map<string, string[]>>();
	for (const row of optionalAll(
		database,
		"election_licence",
		"SELECT e.dataset_id, e.date, el.licence_id FROM election e JOIN election_licence el ON el.election_id = e.id ORDER BY e.dataset_id, e.date, el.licence_id",
	)) {
		const dates =
			electionLicences.get(row.dataset_id as number) ??
			new Map<string, string[]>();
		electionLicences.set(row.dataset_id as number, dates);
		const list = dates.get(row.date as string) ?? [];
		list.push(row.licence_id as string);
		dates.set(row.date as string, list);
	}
	const inputs = group(
		optionalAll(
			database,
			"series_input",
			"SELECT series_id, input_series_id, role FROM series_input ORDER BY series_id, role",
		).map(
			(row) =>
				[
					row.series_id as number,
					{
						id: row.input_series_id as number,
						via: (row.role === "weight"
							? "input:weight"
							: "input:value") as AttributionVia,
					},
				] as const,
		),
	);
	const boundaryReleases = new Map<
		number,
		{ sourceId: number; publisher: string; year: number }
	>();
	for (const row of optionalAll(
		database,
		"boundary_release_source",
		"SELECT b.release_id, b.source_id, r.publisher, r.reference_year FROM boundary_release_source b JOIN area_release r ON r.id = b.release_id",
	))
		boundaryReleases.set(row.release_id as number, {
			sourceId: row.source_id as number,
			publisher: row.publisher as string,
			year: row.reference_year as number,
		});
	const crosswalks = group(
		optionalAll(
			database,
			"series_crosswalk",
			"SELECT series_id, crosswalk_id FROM series_crosswalk ORDER BY series_id, position",
		).map((row) => [row.series_id as number, row.crosswalk_id as number]),
	);
	const crosswalkProvenance = group(
		optionalAll(
			database,
			"crosswalk_provenance_source",
			"SELECT crosswalk_id, source_id FROM crosswalk_provenance_source",
		).map((row) => [row.crosswalk_id as number, row.source_id as number]),
	);
	const weightRows = optionalAll(
		database,
		"crosswalk_weight_input",
		"SELECT w.crosswalk_id, w.basis_id, s.source_id FROM crosswalk_weight_input w JOIN crosswalk_input_source s ON s.input = w.input",
	);
	const crosswalkWeights = group(
		weightRows.map((row) => [
			row.crosswalk_id as number,
			row.source_id as number,
		]),
	);
	const basisWeights = group(
		weightRows.map((row) => [
			row.basis_id as string,
			row.source_id as number,
		]),
	);
	const bases = new Set(
		optionalAll(
			database,
			"weight_basis",
			"SELECT id FROM weight_basis",
		).map((row) => row.id as string),
	);
	const seriesModel = new Map(
		optionalAll(
			database,
			"series_model",
			"SELECT series_id, model_id FROM series_model",
		).map((row) => [row.series_id as number, row.model_id as string]),
	);
	const modelInputs = group(
		optionalAll(
			database,
			"model_input",
			"SELECT model_id, role, key FROM model_input ORDER BY model_id, role, key",
		).map(
			(row) =>
				[
					row.model_id as string,
					{ role: row.role as string, key: row.key as string },
				] as const,
		),
	);
	const modelLicences = new Map(
		optionalAll(
			database,
			"model",
			"SELECT id, licence_id FROM model WHERE licence_id IS NOT NULL",
		).map((row) => [row.id as string, row.licence_id as string]),
	);
	return {
		series,
		seriesByKey,
		datasets,
		datasetBySlug,
		sources,
		sourceLicences,
		electionLicences,
		inputs,
		boundaryReleases,
		crosswalks,
		crosswalkProvenance,
		crosswalkWeights,
		basisWeights,
		bases,
		seriesModel,
		modelInputs,
		modelLicences,
	};
};

export interface SeriesAttributionSummary {
	series: number;
	rows: number;
	commercialSafe: number;
	shareAlike: number;
	unknown: number;
}

/** The citation lines that are notices a source asks to be printed. */
const citationNotices = (citation: string | null): string[] =>
	(citation ?? "")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("Contains "));

/**
 * Walks every series' lineage and returns, for each, the sources it depends
 * on. Throws when a `model_input` key names nothing.
 */
export const walkSeriesLineage = (
	database: DatabaseSync,
): Map<number, Closure> => {
	const lineage = readLineage(database);
	const periodLabels = database.prepare(
		"SELECT DISTINCT p.label FROM observation o JOIN period p ON p.id = o.period_id WHERE o.series_id = ?",
	);
	const hasObservation = database
		.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'observation'")
		.get();
	const unresolved: string[] = [];

	const licencesOfSource = (sourceId: number): string[] =>
		lineage.sourceLicences.get(sourceId) ?? [];

	/** The licences of a dataset's source, narrowed to the elections it names. */
	const datasetLicences = (
		datasetId: number,
		dates: readonly string[] | null,
	): string[] => {
		const sourceId = lineage.datasets.get(datasetId)!.sourceId;
		const elections = lineage.electionLicences.get(datasetId);
		if (!elections || dates === null || dates.length === 0)
			return licencesOfSource(sourceId);
		const found = new Set<string>();
		for (const date of dates)
			for (const licence of elections.get(date) ??
				licencesOfSource(sourceId))
				found.add(licence);
		return [...found];
	};

	const memo = new Map<string, Closure>();
	const walk = (
		seriesId: number,
		restrict: string | null,
		trail: readonly number[],
	): Closure => {
		const memoKey = `${seriesId}|${restrict ?? ""}`;
		const cached = memo.get(memoKey);
		if (cached) return cached;
		if (trail.includes(seriesId))
			throw new Error(
				`series lineage loops: ${[...trail, seriesId].map((id) => lineage.series.get(id)!.key).join(" -> ")}`,
			);
		const row = lineage.series.get(seriesId)!;
		const next = [...trail, seriesId];
		const closure: Closure = new Map();

		const dataset = lineage.datasets.get(row.datasetId)!;
		let dates: string[] | null = restrict === null ? null : [restrict];
		if (
			dates === null &&
			hasObservation &&
			lineage.electionLicences.has(row.datasetId)
		)
			dates = (
				periodLabels.all(seriesId) as unknown as { label: string }[]
			).map((period) => period.label);
		add(
			closure,
			dataset.sourceId,
			0,
			"dataset",
			datasetLicences(row.datasetId, dates),
			citationNotices(lineage.sources.get(dataset.sourceId)!.citation),
		);

		const boundary = lineage.boundaryReleases.get(row.releaseId);
		if (boundary)
			add(
				closure,
				boundary.sourceId,
				1,
				"boundaries",
				licencesOfSource(boundary.sourceId),
				[
					...citationNotices(
						lineage.sources.get(boundary.sourceId)!.citation,
					),
					...(OS_BOUNDARY_PUBLISHERS.has(boundary.publisher)
						? [osNotice(boundary.year)]
						: []),
				],
			);

		for (const crosswalkId of lineage.crosswalks.get(seriesId) ?? []) {
			for (const sourceId of lineage.crosswalkProvenance.get(
				crosswalkId,
			) ?? [])
				add(
					closure,
					sourceId,
					1,
					"crosswalk",
					licencesOfSource(sourceId),
					citationNotices(lineage.sources.get(sourceId)!.citation),
				);
			for (const sourceId of lineage.crosswalkWeights.get(crosswalkId) ??
				[])
				add(
					closure,
					sourceId,
					2,
					"crosswalk-weight",
					licencesOfSource(sourceId),
					citationNotices(lineage.sources.get(sourceId)!.citation),
				);
		}

		const inputs = [...(lineage.inputs.get(seriesId) ?? [])];
		if (
			row.derivedFromId !== null &&
			!inputs.some((input) => input.id === row.derivedFromId)
		)
			inputs.push({ id: row.derivedFromId, via: "input:value" });
		for (const input of inputs)
			merge(closure, walk(input.id, restrict, next), input.via);

		const modelId = lineage.seriesModel.get(seriesId);
		for (const input of modelId
			? (lineage.modelInputs.get(modelId) ?? [])
			: []) {
			const roleDate = ROLE_DATE.exec(input.role)?.[1] ?? null;
			const inputSeries = lineage.seriesByKey.get(input.key);
			if (inputSeries !== undefined) {
				merge(
					closure,
					walk(inputSeries, roleDate ?? restrict, next),
					"model-input",
				);
				continue;
			}
			const ref = parseModelInputRef(input.key);
			if (ref?.kind === "dataset") {
				const datasetId = lineage.datasetBySlug.get(ref.slug);
				if (datasetId !== undefined) {
					const sourceId = lineage.datasets.get(datasetId)!.sourceId;
					add(
						closure,
						sourceId,
						1,
						"model",
						datasetLicences(
							datasetId,
							roleDate === null ? null : [roleDate],
						),
						citationNotices(
							lineage.sources.get(sourceId)!.citation,
						),
					);
					continue;
				}
			}
			if (ref?.kind === "weights" && lineage.bases.has(ref.basis)) {
				for (const sourceId of new Set(
					lineage.basisWeights.get(ref.basis) ?? [],
				))
					add(
						closure,
						sourceId,
						2,
						"model",
						licencesOfSource(sourceId),
						citationNotices(
							lineage.sources.get(sourceId)!.citation,
						),
					);
				continue;
			}
			unresolved.push(`${modelId}: ${input.role}: ${input.key}`);
		}
		memo.set(memoKey, closure);
		return closure;
	};

	const result = new Map<number, Closure>();
	for (const id of lineage.series.keys()) result.set(id, walk(id, null, []));
	if (unresolved.length > 0)
		throw new Error(
			`${unresolved.length} model_input keys name no series, dataset or weight basis:\n${[
				...new Set(unresolved),
			]
				.slice(0, 20)
				.join("\n")}`,
		);
	for (const [seriesId, modelId] of lineage.seriesModel) {
		const licence = lineage.modelLicences.get(modelId);
		if (!licence) continue;
		const held = new Set(
			[...result.get(seriesId)!.values()].flatMap((reach) => [
				...reach.licences,
			]),
		);
		if (!held.has(licence))
			throw new Error(
				`model ${modelId} declares ${licence} but series ${lineage.series.get(seriesId)!.key} reaches no source under it`,
			);
	}
	return result;
};

/**
 * Fails the build when a series reaches no source, when an input's source is
 * missing from the series built from it, or when a licence has no attribution
 * statement.
 */
export const checkSeriesAttribution = (database: DatabaseSync): void => {
	const bad = (sql: string, what: string) => {
		const rows = database.prepare(sql).all() as unknown as {
			series: string;
		}[];
		if (rows.length > 0)
			throw new Error(
				`${rows.length} ${what}:\n${rows
					.slice(0, 10)
					.map((row) => row.series)
					.join("\n")}`,
			);
	};
	bad(
		"SELECT s.key AS series FROM series s WHERE NOT EXISTS (SELECT 1 FROM series_source ss WHERE ss.series_id = s.id) ORDER BY s.id",
		"series reach no source",
	);
	bad(
		`SELECT DISTINCT s.key || ' (missing ' || ss.source_id || ' of ' || i.key || ')' AS series
		 FROM (SELECT series_id, input_series_id FROM series_input
		       UNION SELECT id, derived_from_id FROM series WHERE derived_from_id IS NOT NULL) e
		 JOIN series s ON s.id = e.series_id
		 JOIN series i ON i.id = e.input_series_id
		 JOIN series_source ss ON ss.series_id = e.input_series_id
		 WHERE NOT EXISTS (SELECT 1 FROM series_source d WHERE d.series_id = e.series_id AND d.source_id = ss.source_id)
		 ORDER BY 1`,
		"series lack a source of one of their inputs",
	);
	bad(
		"SELECT id AS series FROM licence WHERE trim(attribution) = ''",
		"licences have no attribution statement",
	);
};

/**
 * Writes the three tables and two views and checks them. Needs the series,
 * their inputs, crosswalks and models, and the source and licence tables, so
 * call it after the notional series and crosswalk weight inputs are in.
 */
export const writeSeriesAttribution = (
	database: DatabaseSync,
): SeriesAttributionSummary => {
	const closures = walkSeriesLineage(database);
	database.exec(TABLES);
	const insertSource = database.prepare(
		"INSERT INTO series_source (series_id, source_id, via, vias, depth) VALUES (?, ?, ?, ?, ?)",
	);
	const insertLicence = database.prepare(
		"INSERT INTO series_source_licence (series_id, source_id, licence_id) VALUES (?, ?, ?)",
	);
	const insertNotice = database.prepare(
		"INSERT INTO series_notice (series_id, source_id, notice) VALUES (?, ?, ?)",
	);
	for (const [seriesId, closure] of closures) {
		const notices = combineOsNotices(
			[...closure].flatMap(([sourceId, reach]) =>
				[...reach.notices].map((notice) => [sourceId, notice] as const),
			),
		);
		for (const [sourceId, reach] of [...closure].sort(
			([a], [b]) => a - b,
		)) {
			insertSource.run(
				seriesId,
				sourceId,
				closest(reach),
				[...reach.vias.keys()]
					.sort((a, b) => viaRank(a) - viaRank(b))
					.join(", "),
				reach.depth,
			);
			for (const licence of [...reach.licences].sort())
				insertLicence.run(seriesId, sourceId, licence);
		}
		// A notice another one begins (a statement without its year) is dropped.
		for (const [sourceId, notice] of notices)
			if (
				!notices.some(
					([, other]) => other !== notice && other.startsWith(notice),
				)
			)
				insertNotice.run(seriesId, sourceId, notice);
	}
	checkSeriesAttribution(database);
	database.exec(`CREATE VIEW v_series_attribution AS${ATTRIBUTION_VIEW}`);
	database.exec(`CREATE VIEW v_series_terms AS${TERMS_VIEW}`);
	const counts = database
		.prepare(
			`SELECT count(*) AS series,
			   sum(commercial_use = 1 AND share_alike = 0) AS safe,
			   sum(share_alike = 1) AS sharealike,
			   sum(commercial_use IS NULL OR share_alike IS NULL) AS unknown,
			   (SELECT count(*) FROM series_source) AS rows
			 FROM v_series_terms`,
		)
		.get() as {
		series: number;
		safe: number | null;
		sharealike: number | null;
		unknown: number | null;
		rows: number;
	};
	return {
		series: counts.series,
		rows: counts.rows,
		commercialSafe: counts.safe ?? 0,
		shareAlike: counts.sharealike ?? 0,
		unknown: counts.unknown ?? 0,
	};
};
