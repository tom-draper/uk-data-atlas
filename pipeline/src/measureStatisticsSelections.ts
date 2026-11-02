import type { DatabaseSync } from "node:sqlite";
import {
	STATISTICS_DATASETS,
	type Measure,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import type { CompiledMeasure } from "./catalog/manifest";
import { bindCensusStatistics } from "./bindCensusStatistics";
import { bindStatisticsField } from "./bindStatisticsField";
import { bindCompiledFields } from "./bindCompiledFields";
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
): StatisticsSelection[] | undefined {
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
