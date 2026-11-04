import type { SQLOutputValue } from "node:sqlite";
import { openReadOnlyDatabase, type SqlReader } from "./readOnlyDatabase.ts";
import { sha256 } from "@uk-data-atlas/artifacts";
import type { SourceGeography } from "@uk-data-atlas/measures";

/**
 * Which statistics series an observation artifact is read from. The dataset,
 * measure and members name the series; `geography` takes every release of
 * it, since the statistics tables keep each record on the release its code
 * belongs to, where an artifact lists them all under one code year.
 */
export type StatisticsSelector = {
	datasetId: string;
	measure: string;
	/** Members fixed on each dimension the series carries. */
	dimensions: Record<string, string>;
	geography: string;
	/**
	 * Dimensions summed over, where the artifact is their total and the
	 * statistics tables hold only the parts: population is published by
	 * single year of age, and an area's population is their sum.
	 */
	sum?: string[];
	/**
	 * Releases whose areas the artifact lists. The statistics tables keep a
	 * census record for every code it was published for, where an artifact on
	 * a later code year lists only the codes that year still uses.
	 */
	areasIn?: string[];
	/**
	 * Read an area with no row as zero, where the measure's other series
	 * hold a row for it in the period: a party that stood no candidate in a
	 * contest polled no votes there.
	 */
	absentAsZero?: true;
	/**
	 * The code a row is served under, by the code it is stored under, and
	 * the publisher's code where the record names one: a local election ward
	 * moved onto a geometrically identical code keeps its published code as
	 * `sourceAreaCode`, and a house price compiled onto a redrawn ward's new
	 * code is served under the old code it was published for.
	 */
	servedCodes?: Record<string, { areaCode: string; sourceAreaCode?: string }>;
	/**
	 * Divide by another measure of the same dataset, in the same area and
	 * period, and multiply by `scale`: vote share is a party's votes over
	 * the valid votes, as a percentage.
	 */
	ratio?: {
		measure: string;
		dimensions?: Record<string, string>;
		scale: number;
		/**
		 * Scale the quotient rather than the numerator, as turnout is
		 * computed, so the floating point result is the published one.
		 */
		scaleQuotient?: true;
		/** Another dataset holding the denominator, such as land area. */
		datasetId?: string;
		/** The one period of the denominator used for every period. */
		period?: string;
		/**
		 * Divide the denominator by this first: land area is stored in
		 * hectares, and density is per square kilometre.
		 */
		denominatorDivisor?: number;
	};
	/**
	 * The status of every record, where the API computes the value rather
	 * than reading a published one: population density is `derived`.
	 */
	status?: "derived";
	/**
	 * Measures of the same dataset added to this one in each area and
	 * period: turnout counts valid votes and rejected ballots.
	 */
	plus?: string[];
	/**
	 * A measure of the same dataset holding the half-width of each value's
	 * confidence interval, as unemployment is published. The bounds are the
	 * value less and plus it, rounded to `digits` decimal places.
	 */
	halfWidth?: { measure: string; digits: number };
	/**
	 * Read a contest's text as the category of each record, instead of a
	 * series: the party that won each contest of the dataset's elections.
	 * `measure` and `dimensions` are then unused.
	 */
	contest?: "winner";
};

/**
 * A census table artifact, one row per area and a value per measure, read
 * from one series per column: each column's measure and members, on the
 * table's dataset and geography.
 */
export type StatisticsTableSelector = {
	kind: "measure-table";
	id: string;
	datasetId: string;
	geography: string;
	boundaryYear: number;
	/** The catalogue period the table is published for. */
	period: string;
	/** The catalogue measure each column serves, in column order. */
	measures: string[];
	columns: Array<{ measure: string; dimensions: Record<string, string> }>;
};

/**
 * Which artifacts are read from the statistics tables, and why each other
 * artifact is still read from the observation tables. Written by
 * `pnpm data:build --only statistics-read-path`, which moves an
 * artifact only when its rebuilt bytes are identical to the stored ones.
 */
export type StatisticsReadPath = {
	schemaVersion: 1;
	dataCatalogHash: string;
	statistics: Record<string, StatisticsSelector | StatisticsTableSelector>;
	observations: Record<string, string>;
};

/** What the catalogue says about the artifact being rebuilt. */
export type StatisticsArtifact = {
	measureId: string;
	sourceGeography: SourceGeography;
	/** The catalogue's periods for the source, in its order. */
	periods: string[];
};

type Row = {
	code: string;
	period: string;
	/** Set where the record is a category rather than a value. */
	category?: string;
	value: number | null;
	lower: number | null;
	upper: number | null;
	status: string;
};

/** The ids of the series a selector names. */
const selectedSeries = (
	database: SqlReader,
	selector: Pick<
		StatisticsSelector,
		"datasetId" | "measure" | "dimensions" | "geography" | "sum"
	>,
) => {
	const series = database
		.prepare(
			"SELECT s.id FROM series s JOIN dataset d ON d.id = s.dataset_id JOIN measure m ON m.id = s.measure_id JOIN area_releases r ON r.position = s.release_id WHERE d.slug = ? AND m.slug = ? AND r.geography = ? ORDER BY s.id",
		)
		.all(selector.datasetId, selector.measure, selector.geography)
		.map((row) => Number(row.id));
	const members = database.prepare(
		"SELECT d.slug AS dimension, m.code FROM series_member sm JOIN dimension d ON d.id = sm.dimension_id JOIN dimension_member m ON m.id = sm.member_id WHERE sm.series_id = ?",
	);
	const summed = new Set(selector.sum ?? []);
	return series.filter((id) => {
		const held = new Map(
			members
				.all(id)
				.map((row) => [String(row.dimension), String(row.code)]),
		);
		for (const [dimension, code] of Object.entries(selector.dimensions))
			if (held.get(dimension) !== code) return false;
		for (const dimension of held.keys())
			if (!(dimension in selector.dimensions) && !summed.has(dimension))
				return false;
		return true;
	});
};

const rowsOf = (database: SqlReader, seriesId: number): Row[] =>
	database
		.prepare(
			"SELECT a.code, p.label AS period, o.value, o.lower, o.upper, st.slug AS status FROM observation o JOIN area_version v ON v.id = o.area_version_id JOIN area a ON a.id = v.area_id JOIN period p ON p.id = o.period_id JOIN status st ON st.id = o.status_id WHERE o.series_id = ?",
		)
		.all(seriesId)
		.map((row: Record<string, SQLOutputValue>) => ({
			code: String(row.code),
			period: String(row.period),
			value: row.value === null ? null : Number(row.value),
			lower: row.lower === null ? null : Number(row.lower),
			upper: row.upper === null ? null : Number(row.upper),
			status: String(row.status),
		}));

/**
 * The statistics period a catalogue period is stored as: the same label, or
 * the one label that extends it, such as `2021-census` for `2021` or an
 * election's date for its year.
 */
export const statisticsPeriod = (period: string, held: Set<string>) => {
	if (held.has(period)) return period;
	const extended = [...held].filter((label) =>
		label.startsWith(`${period}-`),
	);
	return extended.length === 1 ? extended[0] : undefined;
};

/** A contest column of a dataset's elections, by polling day and area code. */
const contestRows = (
	database: SqlReader,
	selector: StatisticsSelector,
	column: "winner",
) => {
	const byPeriod = new Map<string, Map<string, Row>>();
	for (const row of database
		.prepare(
			`SELECT area_code AS code, polling_day AS date, ${column} AS category FROM v_contest WHERE dataset = ? AND geography = ? AND ${column} IS NOT NULL`,
		)
		.all(selector.datasetId, selector.geography)) {
		const period = String(row.date);
		let records = byPeriod.get(period);
		if (!records) byPeriod.set(period, (records = new Map()));
		records.set(String(row.code), {
			code: String(row.code),
			period,
			category: String(row.category),
			value: null,
			lower: null,
			upper: null,
			status: "observed",
		});
	}
	return byPeriod;
};

/**
 * The rows of the series a selector names, by period and area code. Parts of
 * a summed dimension are added; `any` takes every series of the measure and
 * keeps one row per area, for the set of areas the measure covers.
 */
const periodRows = (
	database: SqlReader,
	selector: Pick<
		StatisticsSelector,
		"datasetId" | "measure" | "dimensions" | "geography" | "sum"
	>,
	artifact: StatisticsArtifact,
	any = false,
) => {
	const series = any
		? database
				.prepare(
					"SELECT s.id FROM series s JOIN dataset d ON d.id = s.dataset_id JOIN measure m ON m.id = s.measure_id JOIN area_releases r ON r.position = s.release_id WHERE d.slug = ? AND m.slug = ? AND r.geography = ? ORDER BY s.id",
				)
				.all(selector.datasetId, selector.measure, selector.geography)
				.map((row) => Number(row.id))
		: selectedSeries(database, selector);
	if (series.length === 0)
		throw new Error(
			`No statistics series matches ${artifact.measureId} on ${selector.geography}.`,
		);
	const byPeriod = new Map<string, Map<string, Row>>();
	for (const id of series)
		for (const row of rowsOf(database, id)) {
			let records = byPeriod.get(row.period);
			if (!records) byPeriod.set(row.period, (records = new Map()));
			const held = records.get(row.code);
			if (!held) {
				records.set(row.code, { ...row });
				continue;
			}
			if (any) continue;
			if (!selector.sum?.length)
				throw new Error(
					`${row.code} has two ${artifact.measureId} values for ${row.period} in the statistics tables.`,
				);
			if (row.value === null || held.value === null)
				throw new Error(
					`${row.code} has a part with no value for ${row.period}, so ${artifact.measureId} cannot be summed.`,
				);
			held.value += row.value;
		}
	return byPeriod;
};

/**
 * An observation artifact rebuilt from the statistics tables, as the text
 * the data catalogue build stores it as: periods in the catalogue's order,
 * records in area code order, and the content hash of the rest.
 */
export function rebuildStatisticsObservationText(
	database: SqlReader,
	selector: StatisticsSelector | StatisticsTableSelector,
	artifact: StatisticsArtifact,
): string {
	if ("kind" in selector) return rebuildTableText(database, selector);
	const byPeriod = selector.contest
		? contestRows(database, selector, selector.contest)
		: periodRows(database, selector, artifact);
	for (const measure of selector.plus ?? []) {
		const added = periodRows(
			database,
			{ ...selector, measure, dimensions: {}, sum: undefined },
			artifact,
		);
		for (const [period, records] of byPeriod)
			for (const row of records.values()) {
				const value = added.get(period)?.get(row.code)?.value;
				if (row.value === null || value === undefined || value === null)
					throw new Error(
						`${row.code} has no ${measure} to add to ${artifact.measureId} for ${period}.`,
					);
				row.value += value;
			}
	}
	if (selector.absentAsZero) {
		const contests = periodRows(
			database,
			{ ...selector, dimensions: {}, sum: undefined },
			artifact,
			true,
		);
		for (const [period, held] of contests) {
			let records = byPeriod.get(period);
			if (!records) byPeriod.set(period, (records = new Map()));
			for (const code of held.keys())
				if (!records.has(code))
					records.set(code, {
						code,
						period,
						value: 0,
						lower: null,
						upper: null,
						status: "observed",
					});
		}
	}
	if (selector.ratio) {
		const denominators = periodRows(
			database,
			{
				datasetId: selector.ratio.datasetId ?? selector.datasetId,
				measure: selector.ratio.measure,
				dimensions: selector.ratio.dimensions ?? {},
				geography: selector.geography,
			},
			artifact,
		);
		const {
			scale,
			scaleQuotient,
			period: fixed,
			denominatorDivisor,
		} = selector.ratio;
		for (const [period, records] of byPeriod)
			for (const row of records.values()) {
				const stored = denominators
					.get(fixed ?? period)
					?.get(row.code)?.value;
				const denominator =
					stored == null || denominatorDivisor === undefined
						? stored
						: stored / denominatorDivisor;
				if (row.value === null || !denominator || denominator <= 0)
					throw new Error(
						`${row.code} has no ${selector.ratio.measure} to divide ${artifact.measureId} by for ${period}.`,
					);
				row.value = scaleQuotient
					? (row.value / denominator) * scale
					: (scale * row.value) / denominator;
				row.lower = row.upper = null;
			}
	}
	if (selector.halfWidth) {
		const { measure, digits } = selector.halfWidth;
		const widths = periodRows(
			database,
			{ ...selector, measure, dimensions: {}, sum: undefined },
			artifact,
		);
		const round = (value: number) => Number(value.toFixed(digits));
		for (const [period, records] of byPeriod)
			for (const row of records.values()) {
				const width = widths.get(period)?.get(row.code)?.value;
				if (row.value === null || width === undefined || width === null)
					continue;
				row.lower = round(row.value - width);
				row.upper = round(row.value + width);
			}
	}
	if (selector.status)
		for (const records of byPeriod.values())
			for (const row of records.values()) row.status = selector.status;
	if (selector.areasIn) {
		const statement = database.prepare(
			"SELECT a.code FROM area_version v JOIN area a ON a.id = v.area_id JOIN area_releases r ON r.position = v.release_id WHERE r.geography = ? AND r.id = ?",
		);
		const listed = new Set(
			selector.areasIn.flatMap((release) =>
				statement
					.all(selector.geography, release)
					.map((row) => String(row.code)),
			),
		);
		for (const records of byPeriod.values())
			for (const code of records.keys())
				if (!listed.has(code)) records.delete(code);
	}
	const heldPeriods = new Set(byPeriod.keys());
	const periods = artifact.periods.map((period) => {
		const label = statisticsPeriod(period, heldPeriods);
		const records = [...(label ? byPeriod.get(label)! : new Map()).values()]
			.map((row: Row) => {
				const served = selector.servedCodes?.[row.code];
				return {
					row,
					served: served?.areaCode ?? row.code,
					source: served?.sourceAreaCode,
				};
			})
			.sort((left, right) =>
				left.served < right.served
					? -1
					: left.served > right.served
						? 1
						: 0,
			)
			.map(({ row, served, source }) => ({
				areaCode: served,
				...(source === undefined ? {} : { sourceAreaCode: source }),
				...(row.category === undefined
					? { value: row.value }
					: { category: row.category }),
				status: row.status,
				...(row.lower === null || row.upper === null
					? {}
					: {
							confidenceInterval: {
								lower: row.lower,
								upper: row.upper,
							},
						}),
			}));
		return { period, records };
	});
	const sourceGeography = {
		type: artifact.sourceGeography.type,
		boundaryYear: artifact.sourceGeography.boundaryYear,
	};
	const contentHash = sha256(
		JSON.stringify({
			schemaVersion: 1,
			measureId: artifact.measureId,
			sourceGeography,
			periods,
		}),
	);
	return `${JSON.stringify({
		schemaVersion: 1,
		contentHash,
		measureId: artifact.measureId,
		sourceGeography,
		periods,
	})}\n`;
}

/**
 * A census table rebuilt from its columns' series, as the data catalogue
 * build stores it: rows in area code order, null where a column has no row,
 * and the content hash of the rest.
 */
function rebuildTableText(
	database: SqlReader,
	selector: StatisticsTableSelector,
): string {
	const artifact = {
		measureId: selector.id,
		sourceGeography: {
			type: selector.geography,
			boundaryYear: selector.boundaryYear,
		},
		periods: [selector.period],
	} as StatisticsArtifact;
	const columns = selector.columns.map(({ measure, dimensions }) => {
		const byPeriod = periodRows(
			database,
			{
				datasetId: selector.datasetId,
				measure,
				dimensions,
				geography: selector.geography,
			},
			artifact,
		);
		const label = statisticsPeriod(
			selector.period,
			new Set(byPeriod.keys()),
		);
		return label ? byPeriod.get(label)! : new Map<string, Row>();
	});
	const codes = [
		...new Set(columns.flatMap((rows) => [...rows.keys()])),
	].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
	const withoutHash = {
		schemaVersion: 1,
		kind: "measure-table",
		id: selector.id,
		datasetId: selector.datasetId,
		sourceGeography: artifact.sourceGeography,
		period: selector.period,
		measures: selector.measures,
		records: codes.map((code) => [
			code,
			...columns.map((rows) => rows.get(code)?.value ?? null),
		]),
	};
	return `${JSON.stringify({
		...withoutHash,
		contentHash: sha256(JSON.stringify(withoutHash)),
	})}\n`;
}

/** Rebuild one artifact, opening the database for the read. */
export function readStatisticsObservationText(
	path: string,
	selector: StatisticsSelector | StatisticsTableSelector,
	artifact: StatisticsArtifact,
): string {
	const database = openReadOnlyDatabase(path);
	try {
		return rebuildStatisticsObservationText(database, selector, artifact);
	} finally {
		database.release();
	}
}
