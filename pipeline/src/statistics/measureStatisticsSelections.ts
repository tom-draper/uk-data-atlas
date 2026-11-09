import type { DatabaseSync } from "node:sqlite";
import type { Measure } from "@uk-data-atlas/atlas-runtime/catalogue";
import type { CompiledMeasure } from "../catalog/manifest.ts";
import { type StatisticsReadPath } from "@uk-data-atlas/atlas-runtime/catalogue";
import type { MeasureDimensionsConfig } from "@uk-data-atlas/measures";
import { bindCensusStatistics } from "./bindCensusStatistics.ts";
import { bindStatisticsField } from "./bindStatisticsField.ts";
import type { DatasetLookup } from "./declaredFieldSeries.ts";
import { bindCompiledFields } from "./bindCompiledFields.ts";
import { bindReviewedStatistics } from "./bindReviewedStatistics.ts";
import { electionStatisticsExport } from "./electionStatisticsExport.ts";
import {
	expandStatisticsSelection,
	type StatisticsSelection,
} from "./statisticsExport.ts";

type Field = NonNullable<CompiledMeasure["statisticsField"]>;
type Binding = { measureId: string; field: Field };

/** Resolve every catalogue partition, or return nothing rather than a partial measure. */
export function measureStatisticsSelections(
	database: DatabaseSync,
	measure: Measure,
	bindings: readonly Binding[],
	readPath?: StatisticsReadPath,
	ids?: MeasureDimensionsConfig["ids"],
	lookup?: DatasetLookup,
): StatisticsSelection[] | undefined {
	if (
		measure.id === "general-election-winning-party" ||
		measure.id === "local-election-winning-party"
	) {
		const dataset = measure.id.replace(/-winning-party$/, "");
		const rows = database
			.prepare(
				`SELECT r.geography, r.release AS release, p.label AS period FROM dataset d
            JOIN series s ON s.dataset_id=d.id JOIN measure m ON m.id=s.measure_id
            JOIN area_releases r ON r.id=s.release_id JOIN observation o ON o.series_id=s.id
            JOIN period p ON p.id=o.period_id WHERE d.slug=? AND m.slug='source-winning-party'
            GROUP BY r.geography,r.release,p.label`,
			)
			.all(dataset);
		if (
			!measure.sources.every((source) =>
				source.periods.every((period) =>
					rows.some((row) =>
						String(row.period).startsWith(`${period}-`),
					),
				),
			)
		)
			return undefined;
		return rows.map((row) => ({
			dataset,
			measure: "source-winning-party",
			members: {},
			exact: true,
			geography: String(row.geography),
			release: String(row.release),
			periods: [String(row.period)],
		}));
	}
	if (measure.id === "house-price-median") {
		const rows = database
			.prepare(
				`SELECT r.release AS release, p.label AS period FROM dataset d
			JOIN series s ON s.dataset_id=d.id JOIN measure m ON m.id=s.measure_id
			JOIN area_releases r ON r.id=s.release_id JOIN observation o ON o.series_id=s.id
			JOIN period p ON p.id=o.period_id WHERE d.slug='house-price' AND m.slug='house-price-median'
			AND r.geography='ward' AND p.label <= '2022' GROUP BY r.release,p.label`,
			)
			.all();
		if (
			!measure.sources.every((source) =>
				source.periods.every((period) =>
					rows.some((row) => row.period === period),
				),
			)
		)
			return undefined;
		return rows.map((row) => ({
			dataset: "house-price",
			measure: "house-price-median",
			members: {},
			exact: true,
			geography: "ward",
			release: String(row.release),
			periods: [String(row.period)],
		}));
	}
	if (measure.id === "population-density" && readPath) {
		return bindReviewedStatistics(
			database,
			{
				...measure,
				id: "population",
				sources: measure.sources.map((source) => ({
					...source,
					observationArtifact:
						"population-local-authority-observations",
				})),
			},
			readPath,
		);
	}
	if (electionStatisticsExport(measure.id)) {
		const anchor = measure.id.startsWith("general-")
			? "general-election-valid-votes"
			: "local-election-effective-votes";
		const selection = bindCompiledFields(
			database,
			{ ...measure, id: anchor },
			lookup,
		);
		if (
			!selection ||
			measure.sources.some((source) =>
				source.periods.some(
					(period) =>
						!selection.some(
							(part) =>
								part.geography ===
									source.sourceGeography.type &&
								part.periods.some(
									(label) =>
										label === period ||
										label.startsWith(`${period}-`),
								),
						),
				),
			)
		)
			return undefined;
		return selection;
	}
	const census = ids && bindCensusStatistics(database, measure, ids, true);
	if (census) {
		const datasets = new Set(census.map((selection) => selection.dataset));
		const remainingSources = measure.sources.filter(
			(source) => !datasets.has(source.datasetId),
		);
		if (!remainingSources.length)
			return expandStatisticsSelection(database, census);
		const remaining = bindCompiledFields(
			database,
			{ ...measure, sources: remainingSources },
			lookup,
		);
		return remaining
			? [...expandStatisticsSelection(database, census), ...remaining]
			: undefined;
	}
	const compiled = bindCompiledFields(database, measure, lookup);
	if (compiled) return compiled;
	const reviewed =
		readPath && bindReviewedStatistics(database, measure, readPath);
	if (reviewed) return reviewed;
	if (!measure.sources.length) return undefined;
	const result: StatisticsSelection[] = [];
	for (const source of measure.sources) {
		for (const period of source.periods) {
			const matches = bindings.filter(
				({ measureId, field }) =>
					measureId === measure.id &&
					field.dataset === source.datasetId &&
					field.geography === source.sourceGeography.type &&
					field.boundaryYear ===
						source.sourceGeography.boundaryYear &&
					field.publishedPeriod === period,
			);
			if (matches.length !== 1) return undefined;
			const field = matches[0]!.field;
			const selection = bindStatisticsField(
				database,
				field,
				measure.unit,
				lookup,
			);
			if (!selection) return undefined;
			result.push(...selection);
		}
	}
	return result.length
		? expandStatisticsSelection(database, result)
		: undefined;
}
