import { DatabaseSync } from "node:sqlite";
import type { StatisticsVocabulary } from "@uk-data-atlas/measures";
import { CatalogueRows } from "../../src/catalog/rows.ts";

type Cell =
	number | { value: number; lower?: number; upper?: number; status?: string };

/** One published series of the statistics rows, as a test writes it. */
export type FixtureSeries = {
	dataset: string;
	measure: string;
	geography: string;
	/** The area release, such as `2023-uk-bfc`; its year is the code vintage. */
	release: string;
	/** The releases of any area that is not only in the series' own. */
	areaReleases?: Record<string, string[]>;
	/** The dimension members the series is fixed at, by dimension. */
	members?: Record<string, string>;
	/** Observations by period label, then area code. */
	periods: Record<string, Record<string, Cell>>;
};

/** What an edition of a dataset could not place, as the coverage gap rows hold it. */
export type FixtureGap = {
	dataset: string;
	edition: string;
	kind: "election-ward" | "collision-area" | "collision-without-lsoa";
	code: string;
	count: number;
};

/** The party that won an area's contest on a polling day, as `v_contest` holds it. */
export type FixtureContest = {
	dataset: string;
	geography: string;
	/** The polling day, which the contest's period is labelled with. */
	pollingDay: string;
	code: string;
	winner: string;
};

const SCHEMA = `
	CREATE TABLE v_contest (dataset TEXT, geography TEXT, area_code TEXT, polling_day TEXT, winner TEXT);
	CREATE TABLE area_relationship (dataset_id INTEGER, relation TEXT, period_id INTEGER, child_version_id INTEGER, parent_version_id INTEGER);
	CREATE TABLE dataset_coverage_gap (dataset_id INTEGER, edition TEXT, kind TEXT, position INTEGER, area_code TEXT, count INTEGER);
	CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE measure (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
	CREATE TABLE area (id INTEGER PRIMARY KEY, code TEXT);
	CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
	CREATE TABLE series (id INTEGER PRIMARY KEY, dataset_id INTEGER, measure_id INTEGER, release_id INTEGER, method TEXT NOT NULL DEFAULT 'published');
	CREATE TABLE dimension (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE dimension_member (id INTEGER PRIMARY KEY, dimension_id INTEGER, code TEXT);
	CREATE TABLE series_member (series_id INTEGER, dimension_id INTEGER, member_id INTEGER);
	CREATE TABLE period (id INTEGER PRIMARY KEY, label TEXT);
	CREATE TABLE status (id INTEGER PRIMARY KEY, slug TEXT);
	CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, status_id INTEGER, value REAL, lower REAL, upper REAL);
`;

/**
 * An in-memory copy of the statistics rows holding only the given series,
 * with the vocabulary they imply, for testing a catalogue reader.
 */
export const fixtureRows = (
	series: FixtureSeries[],
	gaps: FixtureGap[] = [],
	contests: FixtureContest[] = [],
): CatalogueRows => {
	const database = new DatabaseSync(":memory:");
	database.exec(SCHEMA);
	const ids = new Map<string, number>();
	const idOf = (
		table: string,
		key: string,
		columns: string,
		values: unknown[],
	) => {
		const id = ids.get(`${table}:${key}`);
		if (id !== undefined) return id;
		const created = Number(
			database
				.prepare(
					`INSERT INTO ${table} (${columns}) VALUES (${values.map(() => "?").join(", ")}) RETURNING id`,
				)
				.get(...(values as never[]))!.id,
		);
		ids.set(`${table}:${key}`, created);
		return created;
	};
	const vocabulary: StatisticsVocabulary = {
		schemaVersion: 1,
		measures: {},
		dimensions: {},
	};
	for (const entry of series) {
		vocabulary.measures[entry.measure] ??= {
			label: entry.measure,
			description: "",
			unit: "",
			valueKind: "quantity",
			aggregation: "sum",
		} as never;
		const release = idOf(
			"area_release",
			`${entry.geography}:${entry.release}`,
			"geography, release",
			[entry.geography, entry.release],
		);
		const seriesId = Number(
			database
				.prepare(
					"INSERT INTO series (dataset_id, measure_id, release_id) VALUES (?, ?, ?) RETURNING id",
				)
				.get(
					idOf("dataset", entry.dataset, "slug", [entry.dataset]),
					idOf("measure", entry.measure, "slug", [entry.measure]),
					release,
				)!.id,
		);
		for (const [dimension, member] of Object.entries(entry.members ?? {})) {
			const dimensionId = idOf("dimension", dimension, "slug", [
				dimension,
			]);
			const vocabularyDimension = (vocabulary.dimensions[dimension] ??= {
				label: dimension,
				members: [],
			});
			if (!vocabularyDimension.members.some((m) => m.code === member))
				vocabularyDimension.members.push({
					code: member,
					label: member,
				});
			database
				.prepare("INSERT INTO series_member VALUES (?, ?, ?)")
				.run(
					seriesId,
					dimensionId,
					idOf(
						"dimension_member",
						`${dimension}:${member}`,
						"dimension_id, code",
						[dimensionId, member],
					),
				);
		}
		for (const [label, cells] of Object.entries(entry.periods))
			for (const [code, cell] of Object.entries(cells)) {
				const { value, lower, upper, status } =
					typeof cell === "number"
						? ({ value: cell } as Exclude<Cell, number>)
						: cell;
				const area = idOf("area", code, "code", [code]);
				const releases = entry.areaReleases?.[code] ?? [entry.release];
				for (const name of releases)
					idOf(
						"area_version",
						`${code}:${name}`,
						"area_id, release_id",
						[
							area,
							idOf(
								"area_release",
								`${entry.geography}:${name}`,
								"geography, release",
								[entry.geography, name],
							),
						],
					);
				database
					.prepare(
						"INSERT INTO observation VALUES (?, ?, ?, ?, ?, ?, ?)",
					)
					.run(
						seriesId,
						ids.get(`area_version:${code}:${releases[0]}`)!,
						idOf("period", label, "label", [label]),
						idOf("status", status ?? "observed", "slug", [
							status ?? "observed",
						]),
						value,
						lower ?? null,
						upper ?? null,
					);
			}
	}
	const positions = new Map<string, number>();
	for (const gap of gaps) {
		const key = `${gap.dataset}:${gap.edition}:${gap.kind}`;
		const position = positions.get(key) ?? 0;
		positions.set(key, position + 1);
		database
			.prepare(
				"INSERT INTO dataset_coverage_gap VALUES (?, ?, ?, ?, ?, ?)",
			)
			.run(
				idOf("dataset", gap.dataset, "slug", [gap.dataset]),
				gap.edition,
				gap.kind,
				position,
				gap.code,
				gap.count,
			);
	}
	for (const contest of contests)
		database
			.prepare("INSERT INTO v_contest VALUES (?, ?, ?, ?, ?)")
			.run(
				contest.dataset,
				contest.geography,
				contest.code,
				contest.pollingDay,
				contest.winner,
			);
	return new CatalogueRows(database, vocabulary);
};
