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
	const { dataCatalog, crosswalkInventory, crosswalkLookup } = context;
	if (!dataCatalog || !crosswalkInventory || !crosswalkLookup)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the data catalogue and crosswalks before reconciling a measure.",
		);
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
	const period = parsedUrl.searchParams.get("period");
	// Without a crosswalk, the comparisons this measure's partitions allow are
	// listed rather than one being chosen for the caller.
	if (!crosswalkId)
		return {
			status: 200,
			body: envelope(releaseId, {
				measure: { id: measure.id, unit: measure.unit },
				available,
				note: "Name a crosswalk and period to compare the finer partition, added up through it, with the coarser partition's own published values.",
			}),
		};
	if (!period)
		return problem(
			400,
			"Invalid Query",
			"period is required with crosswalk: a reconciliation compares one period.",
		);
	const reconciliation = reconcileMeasure(
		context,
		measure,
		crosswalkId,
		period,
	);
	if ("refusal" in reconciliation)
		return problem(422, "Operation Not Supported", reconciliation.refusal, {
			code: "conversion_not_available",
		});
	return { status: 200, body: envelope(releaseId, reconciliation) };
};
