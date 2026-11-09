import type { DatabaseSync } from "node:sqlite";
import type { DatasetModule } from "@uk-data-atlas/datasets/declaration/modules";
import type {
	AreaRelationship,
	CandidacyColumn,
	ContestColumn,
	StatisticsDimension,
	StatisticsMeasure,
	StatisticsParty,
	StatisticsPeriod,
	StatisticsSource,
	StatusSlug,
	SeriesMethod,
} from "@uk-data-atlas/datasets/declaration/vocabulary";

export * from "@uk-data-atlas/datasets/declaration/vocabulary";

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
	/** The topic the dataset belongs to. */
	module: DatasetModule;
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
	/** Record keys for areas the file keys by something other than their code. */
	areaKeys?: () => Iterable<{
		release: AreaRelease;
		code: string;
		key: string;
	}>;
	/** The elections the dataset holds, each with a contest per area. */
	elections?: () => Iterable<StatisticsElection>;
	/** Names and colours for the parties its elections mention. */
	parties?: readonly StatisticsParty[];
	/**
	 * Contest columns whose text names an area of a geography. A name that is
	 * exactly one area's name in the nearest release is stored as that area.
	 */
	contestAreas?: Partial<Record<"region" | "country", string>>;
	/** Areas a publisher relates to other areas, such as the one containing them. */
	relationships?: () => Iterable<{
		relation: AreaRelationship;
		/** The label of the period the publisher states it for. */
		period: string;
		child: { release: AreaRelease; code: string };
		parent: { release: AreaRelease; code: string };
	}>;
	/** Runs once every row is written, before the database is published. */
	verify?: (database: DatabaseSync) => void;
};

/**
 * An election a dataset holds: its polling day and kind, with a contest for
 * each area. `label` is the publisher's name for the election, such as `2024`
 * or `1974O`.
 */
export type StatisticsElection = {
	label: string;
	kind: "general" | "local";
	/** The polling day, as `YYYY-MM-DD`. */
	date: string;
	/** The release the contests' areas are on. */
	release: AreaRelease;
	contests: {
		release: AreaRelease;
		code: string;
		contest?: Partial<Record<ContestColumn, string | null>>;
		/** The candidate the contest elected, when the publisher names one. */
		elected?: Partial<Record<CandidacyColumn, string | null>>;
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
	/** The same, or nothing when the atlas holds no release for the year. */
	find(geography: string, year: number): AreaRelease | undefined;
	has(release: AreaRelease, code: string): boolean;
};

export type StatisticsInput =
	StatisticsDataset | ((areas: AreaIndex) => StatisticsDataset);

export const seriesKey = (dataset: string, series: StatisticsSeries): string =>
	[
		dataset,
		series.measure,
		`${series.release.geography}:${series.release.id}`,
		...Object.entries(series.members ?? {})
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
			.map(([dimension, member]) => `${dimension}=${member}`),
	].join("/");
