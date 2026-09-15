import { explainAreaAbsence } from "./areaAbsence";
import {
	MAX_BATCH_VALUES,
	summariseBatch,
	validateBatch,
} from "./batchValidation";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Validate many area codes or names against one published boundary release. */
export const handleAreaValidationRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas:validate"
	)
		return undefined;
	const { areaInventory, areaLookup, boundaryRegistry } = context;
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryRelease = parsedUrl.searchParams.get("release");
	const values = parsedUrl.searchParams.getAll("value");
	if (!geography || !boundaryRelease)
		return problem(
			400,
			"Invalid Query",
			"geography and release are required: values are validated against one exact boundary release. /v1/boundary-releases:resolve finds the release for a date.",
		);
	if (values.length === 0)
		return problem(
			400,
			"Invalid Query",
			"Supply at least one value to validate, as value=; it may be repeated.",
		);
	if (values.length > MAX_BATCH_VALUES)
		return problem(
			400,
			"Invalid Query",
			`At most ${MAX_BATCH_VALUES} values can be validated in one request; this one has ${values.length}.`,
		);
	if (!areaLookup?.has(`${geography}/${boundaryRelease}`)) {
		const { detail, ...absence } = explainAreaAbsence(
			boundaryRegistry,
			areaInventory,
			areaLookup,
			geography,
			boundaryRelease,
			"",
		);
		return problem(404, "Not Found", detail, absence);
	}
	const results = validateBatch(
		areaLookup,
		geography,
		boundaryRelease,
		values,
	);
	return {
		status: 200,
		body: envelope(releaseId, {
			geography,
			boundaryRelease,
			summary: summariseBatch(results),
			values: results,
			note: 'Codes are checked against this exact release; one it does not hold says whether other releases or geographies do. Names match only exactly, through a published alias, or with an administrative title such as "City of" set aside, and a name meaning several areas lists them all rather than choosing. Anything trimmed or re-cased to read a value is listed in normalised. joinable is true only when every value names exactly one area of this release.',
		}),
	};
};
