import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-db";
import type {
	StatisticsReadPath,
	StatisticsSelector,
	StatisticsTableSelector,
} from "./atlasStatisticsObservations.ts";

/** Read the validated artifact selectors from a compiled atlas database. */
export function readAtlasStatisticsReadPath(path: string): StatisticsReadPath {
	const db = openReadOnlyDatabase(path);
	try {
		const metadata = db
			.prepare(
				"SELECT schema_version, data_catalog_hash FROM statistics_read_path",
			)
			.get();
		if (!metadata || metadata.schema_version !== 1)
			throw new Error(`Invalid statistics read path in ${path}`);
		const result: StatisticsReadPath = {
			schemaVersion: 1,
			dataCatalogHash: String(metadata.data_catalog_hash),
			statistics: {},
			observations: {},
		};
		for (const r of db
			.prepare("SELECT * FROM statistics_selector ORDER BY artifact")
			.all()) {
			const name = String(r.artifact);
			if (r.kind === "measure-table")
				result.statistics[name] = {
					kind: "measure-table",
					id: String(r.table_id),
					datasetId: String(r.dataset),
					geography: String(r.geography),
					boundaryYear: Number(r.boundary_year),
					period: String(r.period),
					measures: [],
					columns: [],
				};
			else {
				const s: StatisticsSelector = {
					datasetId: String(r.dataset),
					geography: String(r.geography),
					measure: String(r.measure),
					dimensions: {},
				};
				if (r.absent_as_zero === 1) s.absentAsZero = true;
				if (r.status === "derived") s.status = "derived";
				if (r.contest === "winner") s.contest = "winner";
				if (r.ratio_measure !== null)
					s.ratio = {
						measure: String(r.ratio_measure),
						scale: Number(r.ratio_scale),
						...(r.ratio_scale_quotient === 1
							? { scaleQuotient: true as const }
							: {}),
						...(r.ratio_dataset === null
							? {}
							: { datasetId: String(r.ratio_dataset) }),
						...(r.ratio_period === null
							? {}
							: { period: String(r.ratio_period) }),
						...(r.ratio_denominator_divisor === null
							? {}
							: {
									denominatorDivisor: Number(
										r.ratio_denominator_divisor,
									),
								}),
					};
				if (r.half_width_measure !== null)
					s.halfWidth = {
						measure: String(r.half_width_measure),
						digits: Number(r.half_width_digits),
					};
				result.statistics[name] = s;
			}
		}
		for (const row of db
			.prepare("SELECT * FROM statistics_selector_option")
			.all()) {
			const selector = result.statistics[
				String(row.artifact)
			] as StatisticsSelector;
			if (row.option === "sum") selector.sum = [];
			else if (row.option === "areas_in") selector.areasIn = [];
			else if (row.option === "plus") selector.plus = [];
			else if (row.option === "served_codes") selector.servedCodes = {};
			else if (row.option === "ratio_dimensions")
				selector.ratio!.dimensions = {};
		}
		for (const r of db
			.prepare(
				"SELECT * FROM statistics_selector_member ORDER BY artifact, role, dimension",
			)
			.all()) {
			const s = result.statistics[
				String(r.artifact)
			] as StatisticsSelector;
			(r.role === "ratio" ? (s.ratio!.dimensions ??= {}) : s.dimensions)[
				String(r.dimension)
			] = String(r.member);
		}
		for (const r of db
			.prepare(
				"SELECT * FROM statistics_selector_list ORDER BY artifact, role, position",
			)
			.all()) {
			const s = result.statistics[String(r.artifact)]!;
			const v = String(r.value);
			if (r.role === "table_measure")
				(s as StatisticsTableSelector).measures.push(v);
			else {
				const selector = s as StatisticsSelector;
				if (r.role === "sum") (selector.sum ??= []).push(v);
				else if (r.role === "areas_in")
					(selector.areasIn ??= []).push(v);
				else (selector.plus ??= []).push(v);
			}
		}
		for (const r of db
			.prepare(
				"SELECT * FROM statistics_selector_code ORDER BY artifact, stored_code",
			)
			.all()) {
			const s = result.statistics[
				String(r.artifact)
			] as StatisticsSelector;
			(s.servedCodes ??= {})[String(r.stored_code)] = {
				areaCode: String(r.area_code),
				...(r.source_area_code === null
					? {}
					: { sourceAreaCode: String(r.source_area_code) }),
			};
		}
		for (const r of db
			.prepare(
				"SELECT * FROM statistics_selector_column ORDER BY artifact, position",
			)
			.all())
			(
				result.statistics[String(r.artifact)] as StatisticsTableSelector
			).columns.push({ measure: String(r.measure), dimensions: {} });
		for (const r of db
			.prepare(
				"SELECT * FROM statistics_selector_column_member ORDER BY artifact, position, dimension",
			)
			.all())
			(
				result.statistics[String(r.artifact)] as StatisticsTableSelector
			).columns[Number(r.position)]!.dimensions[String(r.dimension)] =
				String(r.member);
		for (const r of db
			.prepare(
				"SELECT * FROM statistics_observation_fallback ORDER BY artifact",
			)
			.all())
			result.observations[String(r.artifact)] = String(r.reason);
		return result;
	} finally {
		db.release();
	}
}
