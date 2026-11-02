import type { DatabaseSync } from "node:sqlite";
import {
	STATISTICS_DATASETS,
	type Measure,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import type { CompiledMeasure } from "./catalog/manifest";
import type { StatisticsReadPath } from "@uk-data-atlas/atlas-runtime/storage";
import { bindCensusStatistics } from "./bindCensusStatistics";
import { bindStatisticsField } from "./bindStatisticsField";
import { bindCompiledFields } from "./bindCompiledFields";
import { bindReviewedStatistics } from "./bindReviewedStatistics";
import { electionStatisticsExport } from "./electionStatisticsExport";
import {
	expandStatisticsSelection,
	type StatisticsSelection,
} from "./statisticsExport";

type Field = NonNullable<CompiledMeasure["statisticsField"]>;
type Binding = { measureId: string; field: Field };

/** Resolve every catalogue partition, or return nothing rather than a partial measure. */
export function measureStatisticsSelections(
	database: DatabaseSync,
	measure: Measure,
	bindings: readonly Binding[],
	readPath?: StatisticsReadPath,
): StatisticsSelection[] | undefined {
	if (electionStatisticsExport(measure.id)) {
		const anchor = measure.id.startsWith("general-")
			? "general-election-valid-votes"
			: "local-election-effective-votes";
		const selection = bindCompiledFields(database, {
			...measure,
			id: anchor,
		});
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
	const census = bindCensusStatistics(database, measure, true);
	if (census) {
		const datasets = new Set(census.map((selection) => selection.dataset));
		const remainingSources = measure.sources.filter(
			(source) => !datasets.has(source.datasetId),
		);
		if (!remainingSources.length)
			return expandStatisticsSelection(database, census);
		const remaining = bindCompiledFields(database, {
			...measure,
			sources: remainingSources,
		});
		return remaining
			? [...expandStatisticsSelection(database, census), ...remaining]
			: undefined;
	}
	const compiled = bindCompiledFields(database, measure);
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
			const config = STATISTICS_DATASETS.find(
				({ type }) =>
					type.replace(
						/[A-Z]/g,
						(letter) => `-${letter.toLowerCase()}`,
					) === field.dataset,
			);
			const selection = bindStatisticsField(
				database,
				field,
				measure.unit,
				config,
			);
			if (!selection) return undefined;
			result.push(...selection);
		}
	}
	return result.length
		? expandStatisticsSelection(database, result)
		: undefined;
}
