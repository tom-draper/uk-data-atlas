import type { MeasureSource } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	numericObservationsFor,
	type NumericObservationSuccess,
} from "./numericObservations";
import type { ObservationArtifacts } from "@uk-data-atlas/atlas-runtime/catalogue";
import { problem, type ApiResponse } from "@uk-data-atlas/atlas-runtime/api";

/** Read the numeric, source-exact records required by an aggregate. */
export const readAggregateObservations = ({
	measureId,
	source,
	period,
	artifacts,
}: {
	measureId: string;
	source: MeasureSource;
	period: string;
	artifacts: ObservationArtifacts;
}): NumericObservationSuccess | ApiResponse => {
	const result = numericObservationsFor(measureId, source, period, artifacts);
	if (result.kind === "missing") {
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} is missing, or does not contain the catalogue's declared source period.`,
		);
	}
	if (result.kind === "non_numeric") {
		return problem(
			503,
			"Catalogue Unavailable",
			`The observation artifact for ${measureId} does not contain numeric records required for aggregation.`,
		);
	}
	return result;
};
