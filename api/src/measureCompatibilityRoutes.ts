import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Published boundary code-set compatibility candidates for one measure. */
export const handleMeasureCompatibilityRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 4 ||
		segments[0] !== "v1" ||
		segments[1] !== "measures" ||
		segments[3] !== "compatibility"
	)
		return undefined;
	const inventory = context.measureCompatibilityInventory;
	if (!inventory)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build measure compatibility before retrieving compatible boundary releases.",
		);
	const measure = inventory.measures.find(
		(candidate) => candidate.measureId === segments[2],
	);
	return measure
		? {
				status: 200,
				body: envelope(releaseId, {
					...measure,
					note: "Candidates report code-set compatibility only. They do not select a geometry release or assert equal geometry.",
				}),
			}
		: problem(
				404,
				"Not Found",
				"No published measure compatibility record matches that id.",
			);
};
