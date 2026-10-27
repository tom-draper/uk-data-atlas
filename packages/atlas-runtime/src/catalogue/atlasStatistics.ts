import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { SqliteTable } from "@uk-data-atlas/artifacts";

/**
 * The canonical statistics tables (layer 4 of docs/sqlite-schema-design.md):
 * datasets, measures, dimensions, series and observations as integer-keyed
 * rows. A dataset joins by describing itself as a `StatisticsDataset`; the
 * schema does not change per dataset.
 *
 * Until area identity lands (step 2), an area version is a row of `areas`
 * and a boundary release is a row of `area_releases`. Observation rows key
 * on `areas.id` so step 2 can keep the same ids as `area_version.id`.
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
	/** Runs once every row is written, before the database is published. */
	verify?: (database: DatabaseSync) => void;
};

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

export function statisticsTables(
	datasets: readonly StatisticsDataset[],
): Record<string, SqliteTable> {
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
		sources.add(
			JSON.stringify([
				dataset.source.publisher,
				dataset.source.url,
				dataset.source.licence,
			]),
			dataset.source,
		);
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
						"SELECT id, code, name FROM areas WHERE releasePosition = ?",
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
	const statusIds = new Map<string, number>(
		STATUSES.map(([slug], index) => [slug, index + 1]),
	);

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
			rows: sources.items.map((source, index) => [
				index + 1,
				source.publisher,
				source.url ?? null,
				source.licence,
				source.licenceUrl ?? null,
				source.citation ?? null,
			]),
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
			rows: datasets.map((dataset, index) => [
				index + 1,
				dataset.slug,
				dataset.title,
				dataset.description,
				sources.id(
					JSON.stringify([
						dataset.source.publisher,
						dataset.source.url,
						dataset.source.licence,
					]),
					dataset.slug,
				),
				dataset.released ?? null,
				dataset.fingerprint,
			]),
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
			rows: measures.items.map((measure, index) => [
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
			rows: dimensions.items.map((dimension, index) => [
				index + 1,
				dimension.slug,
				dimension.label,
			]),
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
			rows: members.items.map((member, index) => [
				index + 1,
				member.dimension,
				member.code,
				member.label,
				member.parent,
				member.position,
			]),
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
			rows: periods.items.map((period, index) => [
				index + 1,
				period.label,
				period.kind,
				period.start,
				period.end,
			]),
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
			indexes: [["dataset_id", "measure_id"]],
			rows: function* (database) {
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
			},
		},
		series_member: {
			strict: true,
			columns: [
				"series_id INTEGER NOT NULL REFERENCES series(id)",
				"dimension_id INTEGER NOT NULL REFERENCES dimension(id)",
				"member_id INTEGER NOT NULL REFERENCES dimension_member(id)",
			],
			key: ["series_id", "dimension_id"],
			indexes: [["member_id", "series_id"]],
			rows: seriesRows.flatMap((row, index) =>
				Object.entries(row.series.members ?? {}).map(
					([dimension, member]) => [
						index + 1,
						dimensions.id(dimension, row.key),
						members.id(`${dimension}\0${member}`, row.key),
					],
				),
			),
		},
		dataset_area_name: {
			strict: true,
			columns: [
				"dataset_id INTEGER NOT NULL REFERENCES dataset(id)",
				"area_version_id INTEGER NOT NULL REFERENCES areas(id)",
				"name TEXT NOT NULL",
			],
			key: ["dataset_id", "area_version_id"],
			rows: function* (database): Generator<SQLInputValue[]> {
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
			},
		},
		observation: {
			strict: true,
			columns: [
				"series_id INTEGER NOT NULL REFERENCES series(id)",
				"area_version_id INTEGER NOT NULL REFERENCES areas(id)",
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
			indexes: [["area_version_id", "series_id", "period_id"]],
			rows: function* (database): Generator<SQLInputValue[]> {
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
						"SELECT count(*) AS n FROM observation o JOIN series s ON s.id = o.series_id JOIN areas a ON a.id = o.area_version_id WHERE a.releasePosition <> s.release_id",
					)
					.get();
				if (Number(mismatched?.n) !== 0)
					throw new Error(
						"Observations outside their series' release",
					);
				for (const dataset of datasets) dataset.verify?.(database);
			},
			views: {
				v_observation: `
SELECT d.slug AS dataset, m.slug AS measure, m.unit,
  (SELECT group_concat(dim.slug || '=' || dm.code, '; ')
   FROM series_member sm JOIN dimension dim ON dim.id = sm.dimension_id
   JOIN dimension_member dm ON dm.id = sm.member_id
   WHERE sm.series_id = s.id) AS members,
  a.code AS area_code, coalesce(n.name, a.name) AS area_name,
  r.geography, r.id AS release, p.label AS period,
  o.value, o.lower, o.upper, c.code AS category, st.slug AS status,
  s.method, src.licence
FROM observation o
JOIN series s ON s.id = o.series_id
JOIN dataset d ON d.id = s.dataset_id
JOIN source src ON src.id = d.source_id
JOIN measure m ON m.id = s.measure_id
JOIN areas a ON a.id = o.area_version_id
JOIN area_releases r ON r.position = s.release_id
JOIN period p ON p.id = o.period_id
JOIN status st ON st.id = o.status_id
LEFT JOIN dimension_member c ON c.id = o.category_id
LEFT JOIN dataset_area_name n ON n.dataset_id = d.id AND n.area_version_id = a.id`,
			},
		},
	};
}
