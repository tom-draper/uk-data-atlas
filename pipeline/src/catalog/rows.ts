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
		return selector;
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
