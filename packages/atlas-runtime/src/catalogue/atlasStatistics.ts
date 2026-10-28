import {
	ATLAS_BOUNDARY_VINTAGES,
	type AtlasBoundaryVintages,
} from "@uk-data-atlas/catalogue";
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { SqliteTable } from "@uk-data-atlas/artifacts";

/**
 * The canonical statistics tables (layer 4 of docs/sqlite-schema-design.md):
 * datasets, measures, dimensions, series and observations as integer-keyed
 * rows. A dataset joins by describing itself as a `StatisticsDataset`; the
 * schema does not change per dataset.
 *
 * Observations key on `area_version`, a code as it appears in one release.
 * Until boundary releases get their own table, a release is a row of
 * `area_releases`.
 */

export type ValueKind =
	| "count"
	| "rate"
	| "share"
	| "median"
	| "mean"
	| "index"
	| "rank"
	| "amount"
	| "category";
export type Aggregation = "sum" | "ratio" | "weighted_mean" | "none";
export type PeriodKind =
	| "year"
	| "financial_year"
	| "academic_year"
	| "quarter"
	| "month"
	| "date"
	| "range";
export type SeriesMethod =
	"published" | "converted" | "aggregated" | "modelled";

export const STATUSES = [
	["observed", "Observed"],
	["estimated", "Estimated"],
	["provisional", "Provisional"],
	["suppressed", "Suppressed"],
	["not_applicable", "Not applicable"],
] as const;
export type StatusSlug = (typeof STATUSES)[number][0];

export type StatisticsSource = {
	publisher: string;
	url?: string;
	licence: string;
	licenceUrl?: string;
	citation?: string;
};

/** A measure is shared across datasets: `households` means the same everywhere. */
export type StatisticsMeasure = {
	slug: string;
	label: string;
	description: string;
	unit: string;
	valueKind: ValueKind;
	aggregation: Aggregation;
	/** Slugs of measures declared earlier, for `ratio` measures. */
	numerator?: string;
	denominator?: string;
};

export type StatisticsDimension = {
	slug: string;
	label: string;
	/** In the publisher's order. `parent` is the code of an earlier member. */
	members: { code: string; label: string; parent?: string }[];
};

export type StatisticsPeriod = {
	label: string;
	kind: PeriodKind;
	start: string;
	end: string;
};

export type AreaRelease = { geography: string; id: string };

/** One measure, one combination of dimension members, on one release. */
export type StatisticsSeries = {
	measure: string;
	release: AreaRelease;
	/** Dimension slug to member code. */
	members?: Record<string, string>;
	method?: SeriesMethod;
	/** Index of an earlier series of the same dataset this was derived from. */
	derivedFrom?: number;
};

export type StatisticsObservation = {
	/** Index into the dataset's `series`. */
	series: number;
	/** Area code in the series' release. */
	code: string;
	period: string;
	value: number | null;
	status?: StatusSlug;
	lower?: number;
	upper?: number;
	/** Member code of `categoryDimension`, for `category` measures. */
	category?: string;
};

export type StatisticsDataset = {
	slug: string;
	title: string;
	description: string;
	source: StatisticsSource;
	released?: string;
	fingerprint: string;
	measures: StatisticsMeasure[];
	dimensions?: StatisticsDimension[];
	/** The dimension whose members `category` observations refer to. */
	categoryDimension?: string;
	periods: StatisticsPeriod[];
	series: StatisticsSeries[];
	observations: () => Iterable<StatisticsObservation>;
	/** Publisher names for areas; only those differing from the boundary name are stored. */
	areaNames?: () => Iterable<{
		release: AreaRelease;
		code: string;
		name: string;
	}>;
	/**
	 * How to lay the rows back out as the compiled JSON, for datasets served
	 * from rows. One layout per top-level key of the file.
	 */
	layouts?: () => Iterable<StatisticsLayout>;
	/** Runs once every row is written, before the database is published. */
	verify?: (database: DatabaseSync) => void;
};

/**
 * One leaf of a record, in the record's key order. Every record of a part has
 * the same leaves; only the area and its values change.
 */
export type StatisticsLayoutLeaf = { path: string[] } & (
	| {
			kind: "value" | "lower" | "upper";
			/** Index into the dataset's `series`. */
			series: number;
			period: string;
	  }
	| { kind: "code" | "name" }
	/** A number computed from the record's other values, by a named rule. */
	| { kind: "derived"; rule: string }
	/** The same JSON in every record. */
	| { kind: "literal"; value: string }
);

/** A top-level key of a compiled dataset: its header and record layouts. */
export type StatisticsLayout = {
	key: string;
	/** The header as JSON, with each record set's field set to null. */
	header: string;
	records: {
		from: string;
		leaves: StatisticsLayoutLeaf[];
		/** The records' areas, in the file's order. */
		areas: { release: AreaRelease; code: string }[];
	}[];
};

/**
 * The areas a dataset can be placed on, read from the tables written before
 * the statistics tables. A dataset that routes codes between releases is
 * built from this, as `(areas) => StatisticsDataset`.
 */
export type AreaIndex = {
	/**
	 * The release the atlas draws for a geography and boundary year: the
	 * atlas vintage where one is declared, otherwise the one available release
	 * whose id starts with the year.
	 */
	release(geography: string, year: number): AreaRelease;
	has(release: AreaRelease, code: string): boolean;
};

export type StatisticsInput =
	StatisticsDataset | ((areas: AreaIndex) => StatisticsDataset);

const vintages = ATLAS_BOUNDARY_VINTAGES as AtlasBoundaryVintages &
	Partial<Record<string, Readonly<Record<number, string>>>>;

const same = (a: unknown, b: unknown) =>
	JSON.stringify(a) === JSON.stringify(b);

/** Assign integer ids to text keys, refusing a key declared twice differently. */
class Registry<T> {
	readonly items: T[] = [];
	private readonly ids = new Map<string, number>();
	constructor(private readonly kind: string) {}
	add(key: string, item: T) {
		const id = this.ids.get(key);
		if (id !== undefined) {
			if (!same(this.items[id - 1], item))
				throw new Error(`Conflicting ${this.kind} ${key}`);
			return id;
		}
		this.items.push(item);
		this.ids.set(key, this.items.length);
		return this.items.length;
	}
	id(key: string, context: string) {
		const id = this.ids.get(key);
		if (id === undefined)
			throw new Error(`Unknown ${this.kind} ${key} in ${context}`);
		return id;
	}
}

export const seriesKey = (dataset: string, series: StatisticsSeries): string =>
	[
		dataset,
		series.measure,
		`${series.release.geography}:${series.release.id}`,
		...Object.entries(series.members ?? {})
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([dimension, member]) => `${dimension}=${member}`),
	].join("/");

const sourceKey = (source: StatisticsSource) =>
	JSON.stringify([source.publisher, source.url, source.licence]);

/** Assign ids to everything the datasets declare, refusing conflicts. */
function register(datasets: readonly StatisticsDataset[]) {
	const sources = new Registry<StatisticsSource>("source");
	const measures = new Registry<StatisticsMeasure>("measure");
	const dimensions = new Registry<Omit<StatisticsDimension, "members">>(
		"dimension",
	);
	const members = new Registry<{
		dimension: number;
		code: string;
		label: string;
		parent: number | null;
		position: number;
	}>("dimension member");
	const periods = new Registry<StatisticsPeriod>("period");
	const slugs = new Set<string>();
	const seriesKeys = new Set<string>();
	const seriesIds: number[][] = [];
	const seriesRows: {
		dataset: number;
		series: StatisticsSeries;
		key: string;
	}[] = [];

	for (const [index, dataset] of datasets.entries()) {
		if (slugs.has(dataset.slug))
			throw new Error(`Duplicate dataset ${dataset.slug}`);
		slugs.add(dataset.slug);
		const context = `dataset ${dataset.slug}`;
		sources.add(sourceKey(dataset.source), dataset.source);
		for (const measure of dataset.measures) {
			for (const reference of [measure.numerator, measure.denominator])
				if (reference !== undefined) measures.id(reference, context);
			measures.add(measure.slug, measure);
		}
		for (const { members: list, ...dimension } of dataset.dimensions ??
			[]) {
			const dimensionId = dimensions.add(dimension.slug, dimension);
			for (const [position, member] of list.entries())
				members.add(`${dimension.slug}\0${member.code}`, {
					dimension: dimensionId,
					code: member.code,
					label: member.label,
					parent:
						member.parent === undefined
							? null
							: members.id(
									`${dimension.slug}\0${member.parent}`,
									context,
								),
					position,
				});
		}
		if (dataset.categoryDimension !== undefined)
			dimensions.id(dataset.categoryDimension, context);
		for (const period of dataset.periods) periods.add(period.label, period);
		seriesIds.push(
			dataset.series.map((series, position) => {
				const key = seriesKey(dataset.slug, series);
				if (seriesKeys.has(key))
					throw new Error(`Duplicate series ${key}`);
				seriesKeys.add(key);
				measures.id(series.measure, context);
				for (const [dimension, member] of Object.entries(
					series.members ?? {},
				))
					members.id(`${dimension}\0${member}`, context);
				if (
					(series.method ?? "published") === "published" &&
					series.derivedFrom !== undefined
				)
					throw new Error(
						`Published series ${key} cannot be derived`,
					);
				if (
					series.derivedFrom !== undefined &&
					!(series.derivedFrom >= 0 && series.derivedFrom < position)
				)
					throw new Error(
						`Series ${key} derives from a later series`,
					);
				seriesRows.push({ dataset: index + 1, series, key });
				return seriesRows.length;
			}),
		);
	}
	const category = (dataset: StatisticsDataset, code: string | undefined) => {
		if (code === undefined) return null;
		if (dataset.categoryDimension === undefined)
			throw new Error(
				`Dataset ${dataset.slug} has categories but no categoryDimension`,
			);
		return members.id(
			`${dataset.categoryDimension}\0${code}`,
			dataset.slug,
		);
	};
	return {
		datasets,
		sources,
		measures,
		dimensions,
		members,
		periods,
		seriesIds,
		seriesRows,
		category,
	};
}

export function statisticsTables(
	inputs: readonly StatisticsInput[],
): Record<string, SqliteTable> {
	/** Release positions and area ids, read from the tables written before these. */
	const releases = new Map<string, number>();
	const releaseAreas = new Map<
		number,
		Map<string, { id: number; name: string }>
	>();
	const releasePosition = (database: DatabaseSync, release: AreaRelease) => {
		const key = `${release.geography}:${release.id}`;
		let position = releases.get(key);
		if (position === undefined) {
			const row = database
				.prepare(
					"SELECT position, status FROM area_releases WHERE geography = ? AND id = ?",
				)
				.get(release.geography, release.id);
			if (!row || row.status !== "available")
				throw new Error(`Unknown or unavailable area release ${key}`);
			position = Number(row.position);
			releases.set(key, position);
		}
		return position;
	};
	const areaLookup = (database: DatabaseSync, position: number) => {
		let areas = releaseAreas.get(position);
		if (!areas) {
			areas = new Map(
				database
					.prepare(
						"SELECT v.id, a.code, v.name FROM area_version v JOIN area a ON a.id = v.area_id WHERE v.release_id = ?",
					)
					.all(position)
					.map((row) => [
						String(row.code),
						{ id: Number(row.id), name: String(row.name) },
					]),
			);
			releaseAreas.set(position, areas);
		}
		return areas;
	};
	const area = (
		database: DatabaseSync,
		dataset: string,
		release: AreaRelease,
		code: string,
	) => {
		const found = areaLookup(
			database,
			releasePosition(database, release),
		).get(code);
		if (!found)
			throw new Error(
				`Unknown area ${code} in ${release.geography}/${release.id} for dataset ${dataset}`,
			);
		return found;
	};
	const areaIndex = (database: DatabaseSync): AreaIndex => {
		const available = database
			.prepare(
				"SELECT geography, id FROM area_releases WHERE status = 'available'",
			)
			.all()
			.map((row) => ({
				geography: String(row.geography),
				id: String(row.id),
			}));
		return {
			release(geography, year) {
				const declared = vintages[geography]?.[year];
				if (declared) return { geography, id: declared };
				const matches = available.filter(
					(release) =>
						release.geography === geography &&
						release.id.startsWith(`${year}-`),
				);
				if (matches.length !== 1)
					throw new Error(
						`No single ${geography} release for ${year} (${matches.length} found)`,
					);
				return matches[0];
			},
			has: (release, code) =>
				areaLookup(database, releasePosition(database, release)).has(
					code,
				),
		};
	};

	let prepared: ReturnType<typeof register> | undefined;
	/** Datasets and their registries, built once the area tables exist. */
	const prepare = (database: DatabaseSync) => {
		if (!prepared) {
			const index = areaIndex(database);
			prepared = register(
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
			state: ReturnType<typeof register>,
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
				"kind TEXT NOT NULL CHECK (kind IN ('value','lower','upper','code','name','derived','literal'))",
				"series_id INTEGER REFERENCES series(id)",
				"period_id INTEGER REFERENCES period(id)",
				"rule TEXT",
				"literal TEXT",
			],
			key: ["dataset_id", "part", "records", "position"],
			constraints: [
				"FOREIGN KEY (dataset_id, part) REFERENCES dataset_part(dataset_id, position)",
				"CHECK ((kind IN ('value','lower','upper')) = (series_id IS NOT NULL AND period_id IS NOT NULL))",
				"CHECK ((kind = 'derived') = (rule IS NOT NULL))",
				"CHECK ((kind = 'literal') = (literal IS NOT NULL))",
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
									leaf.kind === "upper";
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
									leaf.kind === "literal" ? leaf.value : null,
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
				// Last statistics table: every row, layouts included, is written.
				for (const dataset of datasets) dataset.verify?.(database);
			}),
		},
	};
}
