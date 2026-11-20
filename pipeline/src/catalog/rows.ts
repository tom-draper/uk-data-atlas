import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import {
	buildDirectory,
	statisticsVocabularyPath,
} from "@uk-data-atlas/atlas-db";
import {
	rebuildStatisticsPeriods,
	selectedStatisticsSeries,
	type MeasureObservationArtifact,
	type MeasureSeriesIdentity,
	type SourceGeography,
	type StatisticsSelector,
	type StatisticsVocabulary,
} from "@uk-data-atlas/measures";
import { isPublishedAreaCode } from "@uk-data-atlas/catalogue/node";
import { readJsonSync } from "../lib/json.ts";
import { selectorFor } from "../statistics/seriesSelector.ts";
import { partitionByCodeYear } from "../statistics/selectorPlans.ts";

/** One catalogue source: a measure's series on one partition of a dataset. */
export type RowSource = {
	series: MeasureSeriesIdentity;
	datasetId: string;
	geography: SourceGeography["type"];
	boundaryYear: number;
};

export type SourcePeriods = MeasureObservationArtifact["periods"];

/**
 * The statistics rows the API catalogue is compiled from: the published
 * series of `atlas-base.sqlite`. A source names the series it reads, and its
 * observations come out as the API serves them, so the catalogue describes
 * exactly what the rows hold.
 */
export class CatalogueRows {
	readonly database: DatabaseSync;
	readonly vocabulary: StatisticsVocabulary;
	constructor(database: DatabaseSync, vocabulary: StatisticsVocabulary) {
		this.database = database;
		this.vocabulary = vocabulary;
	}
	static open(repositoryRoot: string) {
		return new CatalogueRows(
			new DatabaseSync(
				join(buildDirectory(repositoryRoot), "atlas-base.sqlite"),
				{ readOnly: true },
			),
			readJsonSync<StatisticsVocabulary>(
				statisticsVocabularyPath(repositoryRoot),
			),
		);
	}
	close() {
		this.database.close();
	}
	/** The releases of a geography whose code vintage is the given year. */
	releasesIn(geography: string, year: number): string[] {
		return this.database
			.prepare(
				"SELECT release FROM area_release WHERE geography = ? AND release LIKE ? ORDER BY release",
			)
			.all(geography, `${year}-%`)
			.map((row) => String(row.release));
	}
	/**
	 * The editions a dataset publishes on a geography: each period the rows
	 * hold, with the code vintage of the release that holds it.
	 */
	editions(
		datasetId: string,
		geography: string,
	): Array<{ period: string; boundaryYear: number }> {
		return this.database
			.prepare(
				`SELECT DISTINCT p.label AS period, r.release AS release
				FROM series s JOIN dataset d ON d.id = s.dataset_id
				JOIN area_release r ON r.id = s.release_id
				JOIN observation o ON o.series_id = s.id
				JOIN period p ON p.id = o.period_id
				WHERE d.slug = ? AND r.geography = ? AND s.method = 'published'
				ORDER BY p.label, r.release`,
			)
			.all(datasetId, geography)
			.map((row) => ({
				period: String(row.period),
				boundaryYear: Number(String(row.release).slice(0, 4)),
			}));
	}
	/**
	 * What an edition of a dataset could not place, by kind, in the order the
	 * dataset recorded it: an area code, or a count with no area.
	 */
	coverageGaps(
		datasetId: string,
		edition: string,
		kind: string,
	): Array<{ code: string; count: number }> {
		return this.database
			.prepare(
				`SELECT g.area_code AS code, g.count AS count
				FROM dataset_coverage_gap g JOIN dataset d ON d.id = g.dataset_id
				WHERE d.slug = ? AND g.edition = ? AND g.kind = ?
				ORDER BY g.position`,
			)
			.all(datasetId, edition, kind)
			.map((row) => ({
				code: String(row.code),
				count: Number(row.count),
			}));
	}
	/**
	 * How many areas of a geography a dataset holds a measure for in a
	 * period, named by its label or the polling day that extends it.
	 */
	areasHeld(
		datasetId: string,
		geography: string,
		measure: string,
		period: string,
	): number {
		return Number(
			this.database
				.prepare(
					`SELECT COUNT(DISTINCT a.code) AS held
					FROM series s JOIN dataset d ON d.id = s.dataset_id
					JOIN measure m ON m.id = s.measure_id
					JOIN area_release r ON r.id = s.release_id
					JOIN observation o ON o.series_id = s.id
					JOIN period p ON p.id = o.period_id
					JOIN area_version v ON v.id = o.area_version_id
					JOIN area a ON a.id = v.area_id
					WHERE d.slug = ? AND r.geography = ? AND m.slug = ?
					AND s.method = 'published' AND (p.label = ? OR p.label LIKE ?)`,
				)
				.get(datasetId, geography, measure, period, `${period}-%`)!
				.held,
		);
	}
	/**
	 * The codes a dataset's publisher listed areas under that differ from the
	 * area's own, as [published code, area code], for a period named by its
	 * label or the polling day that extends it.
	 */
	publishedAs(datasetId: string, period: string): Array<[string, string]> {
		return this.database
			.prepare(
				`SELECT DISTINCT pa.code AS published, ca.code AS own
				FROM area_relationship r JOIN dataset d ON d.id = r.dataset_id
				JOIN period p ON p.id = r.period_id
				JOIN area_version cv ON cv.id = r.child_version_id
				JOIN area ca ON ca.id = cv.area_id
				JOIN area_version pv ON pv.id = r.parent_version_id
				JOIN area pa ON pa.id = pv.area_id
				WHERE d.slug = ? AND r.relation = 'published-as'
				AND (p.label = ? OR p.label LIKE ?)
				ORDER BY pa.code`,
			)
			.all(datasetId, period, `${period}-%`)
			.map((row) => [String(row.published), String(row.own)]);
	}
	/** The title, description and publisher a dataset's rows record. */
	datasetTerms(datasetId: string): {
		title: string;
		description: string;
		publisher: string;
		url: string;
		licence: { name: string; url?: string };
	} {
		const row = this.database
			.prepare(
				`SELECT d.title AS title, d.description AS description,
				s.publisher AS publisher, s.url AS url, s.licence AS licence,
				s.licence_url AS licenceUrl
				FROM dataset d JOIN source s ON s.id = d.source_id
				WHERE d.slug = ?`,
			)
			.get(datasetId);
		if (!row) throw new Error(`The rows hold no ${datasetId} dataset`);
		return {
			title: String(row.title),
			description: String(row.description),
			publisher: String(row.publisher),
			url: String(row.url),
			licence: {
				name: String(row.licence),
				...(row.licenceUrl ? { url: String(row.licenceUrl) } : {}),
			},
		};
	}
	/** The party codes a dataset's party votes are split by, as stored. */
	partyCodes(datasetId: string): string[] {
		return this.database
			.prepare(
				`SELECT DISTINCT dm.code AS code
				FROM series s JOIN dataset d ON d.id = s.dataset_id
				JOIN measure m ON m.id = s.measure_id
				JOIN series_member sm ON sm.series_id = s.id
				JOIN dimension di ON di.id = sm.dimension_id
				JOIN dimension_member dm ON dm.id = sm.member_id
				WHERE d.slug = ? AND m.slug = 'party-votes' AND di.slug = 'party'
				AND s.method = 'published' ORDER BY dm.code`,
			)
			.all(datasetId)
			.map((row) => String(row.code));
	}
	/** The selector the API reads the source's observations with. */
	selector(source: RowSource): StatisticsSelector {
		const selector = selectorFor(
			this.database,
			this.vocabulary,
			source.series,
			source.datasetId,
			source.geography,
			source.boundaryYear,
		);
		if (typeof selector === "string") throw new Error(selector);
		return partitionByCodeYear(
			selector,
			source.datasetId,
			this.releasesIn(source.geography, source.boundaryYear),
		);
	}
	/** Every period the source's rows hold, as labelled in the rows. */
	heldPeriods(selector: StatisticsSelector): string[] {
		const ids = selectedStatisticsSeries(this.database, selector);
		const labels = this.database.prepare(
			`SELECT DISTINCT p.label FROM observation o JOIN period p ON p.id = o.period_id WHERE o.series_id = ? ORDER BY p.label`,
		);
		return [
			...new Set(
				ids.flatMap((id) =>
					labels.all(id).map((row) => String(row.label)),
				),
			),
		].sort();
	}
	/**
	 * The records of a source for each period, in served code order. Without
	 * `periods` every period the rows hold is read. `adjust` may change the
	 * selector, as a dataset that serves different codes needs.
	 */
	periods(
		source: RowSource,
		periods?: string[],
		adjust?: (selector: StatisticsSelector) => StatisticsSelector,
	): SourcePeriods {
		const base = this.selector(source);
		const selector = adjust ? adjust(base) : base;
		const read = periods ?? this.heldPeriods(selector);
		const result = rebuildStatisticsPeriods(this.database, selector, {
			measureId: source.series.measure,
			sourceGeography: {
				type: source.geography,
				boundaryYear: source.boundaryYear,
			},
			periods: read,
		}) as SourcePeriods;
		for (const { period, records } of result)
			for (const record of records)
				if (!isPublishedAreaCode(record.areaCode))
					throw new Error(
						`${source.datasetId}: unsupported area code ${record.areaCode} in ${period}`,
					);
		return result;
	}
}
