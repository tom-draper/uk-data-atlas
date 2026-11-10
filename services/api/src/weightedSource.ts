import type { DataCatalog, MeasureSource } from "@uk-data-atlas/catalogue/node";
import { dimensionCatalogue } from "@uk-data-atlas/measures";
import {
	measureSeriesKey,
	type MeasureSeriesIdentity,
} from "@uk-data-atlas/measures";
import {
	numericObservationsFor,
	type NumericObservationSuccess,
} from "./numericObservations";
import { resolveObservations } from "./observationResolution/observationPlan";
import type { RouteContextFor } from "./runtime/index.ts";
import { problem, type ApiResponse } from "./runtime/index.ts";

export type WeightedSource = {
	measure: DataCatalog["measures"][number];
	source: MeasureSource;
	observations: NumericObservationSuccess["observations"];
	records: NumericObservationSuccess["records"];
};

/** Resolve the source-exact numeric artifact used as a measure's weight. */
export const readWeightedSource = ({
	context,
	dataCatalog,
	weightMeasureId,
	weightSeriesIdentity,
	measureId,
	period,
	source,
	artifacts,
}: {
	context: RouteContextFor<never>;
	dataCatalog: DataCatalog;
	weightMeasureId: string;
	weightSeriesIdentity?: MeasureSeriesIdentity;
	measureId: string;
	period: string;
	source: MeasureSource;
	artifacts: Parameters<typeof numericObservationsFor>[3];
}): WeightedSource | ApiResponse => {
	const catalogue = context.measureDimensions
		? dimensionCatalogue(dataCatalog, context.measureDimensions)
		: undefined;
	const weightSeries = weightSeriesIdentity
		? catalogue?.series(measureSeriesKey(weightSeriesIdentity))?.series
		: catalogue?.catalogueSeries(weightMeasureId)?.series;
	const weightMeasure =
		weightSeries?.catalogueMeasure ??
		dataCatalog.measures.find(
			(candidate) => candidate.id === weightMeasureId,
		);
	const weightPlan = resolveObservations(context, {
		measureId: weightMeasureId,
		measure: weightMeasure,
		seriesKey: weightSeries?.id,
		periods: [period],
		geography: source.sourceGeography.type,
		boundaryYear: String(source.sourceGeography.boundaryYear),
	});
	const weightSource =
		weightPlan.kind === "plan" ? weightPlan.plan.source : undefined;
	if (!weightMeasure || !weightSource) {
		return problem(
			503,
			"Catalogue Unavailable",
			`No source-exact ${weightMeasureId} partition is available to weight ${measureId}.`,
		);
	}
	const result = numericObservationsFor(
		weightMeasure.id,
		weightSource,
		period,
		{ ...artifacts, seriesKey: weightSeries?.id },
	);
	if (result.kind === "missing") {
		return problem(
			503,
			"Catalogue Unavailable",
			`The weight artifact for ${weightMeasureId} is missing, or does not contain the catalogue's declared source period.`,
		);
	}
	if (result.kind === "non_numeric") {
		return problem(
			503,
			"Catalogue Unavailable",
			`The weight artifact for ${weightMeasureId} does not contain numeric records.`,
		);
	}
	return {
		measure: weightMeasure,
		source: weightSource,
		observations: result.observations,
		records: result.records,
	};
};
