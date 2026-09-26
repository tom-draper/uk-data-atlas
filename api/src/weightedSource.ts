import type { DataCatalog, MeasureSource } from "./dataCatalog";
import {
	numericObservationsFor,
	type NumericObservationSuccess,
} from "./numericObservations";
import { resolveObservations } from "./observationResolution/observationPlan";
import type { RouteContext } from "./routing";
import { problem, type ApiResponse } from "./routeResponse";

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
	measureId,
	period,
	source,
	artifacts,
}: {
	context: RouteContext;
	dataCatalog: DataCatalog;
	weightMeasureId: string;
	measureId: string;
	period: string;
	source: MeasureSource;
	artifacts: Parameters<typeof numericObservationsFor>[3];
}): WeightedSource | ApiResponse => {
	const weightMeasure = dataCatalog.measures.find(
		(candidate) => candidate.id === weightMeasureId,
	);
	const weightPlan = resolveObservations(context, {
		measureId: weightMeasureId,
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
		weightMeasureId,
		weightSource,
		period,
		artifacts,
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
