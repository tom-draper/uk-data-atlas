import {
	availableReconciliations,
	reconcileMeasure,
} from "./measureReconciliation";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Check a measure against itself across two geographies. */
export const handleMeasureReconciliationRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "measures" ||
		segments[3] !== "reconciliation"
	)
		return undefined;
	const { dataCatalog } = context;
	const unavailable = context.geographyResolver.requires("crosswalks");
	if (!dataCatalog)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue and crosswalks before reconciling a measure.",
		);
	if (unavailable) return unavailable;
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === segments[2],
	);
	if (!measure)
		return problem(
			404,
			"Not Found",
			"No published measure matches that id.",
		);
	const available = availableReconciliations(context, measure);
	const crosswalkId = parsedUrl.searchParams.get("crosswalk");
	const pathId = parsedUrl.searchParams.get("path");
	const period = parsedUrl.searchParams.get("period");
	if (crosswalkId && pathId)
		return problem(
			400,
			"Invalid Query",
			"Name either crosswalk or path, not both. A path already names every crosswalk it uses.",
		);
	// Without a crosswalk or path, the comparisons this measure's partitions
	// allow are listed rather than one being chosen for the caller.
	if (!crosswalkId && !pathId)
		return {
			status: 200,
			body: envelope(releaseId, {
				measure: { id: measure.id, unit: measure.unit },
				available,
				note: "Name a crosswalk, or a published relationship path, and a period to compare the finer partition, added up through it, with the coarser partition's own published values.",
			}),
		};
	if (!period)
		return problem(
			400,
			"Invalid Query",
			`period is required with ${crosswalkId ? "crosswalk" : "path"}: a reconciliation compares one period.`,
		);
	const reconciliation = reconcileMeasure(
		context,
		measure,
		crosswalkId ? { crosswalk: crosswalkId } : { path: pathId! },
		period,
	);
	if ("refusal" in reconciliation)
		return problem(422, "Operation Not Supported", reconciliation.refusal, {
			code: "conversion_not_available",
		});
	return { status: 200, body: envelope(releaseId, reconciliation) };
};
