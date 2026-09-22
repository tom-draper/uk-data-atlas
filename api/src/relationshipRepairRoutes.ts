import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** A governed repair queue: discovery is never authority to publish. */
export const handleRelationshipRepairRoutes = ({ context, releaseId, segments }: RouteRequest): ApiResponse | undefined => {
	if (segments.length !== 2 || segments[0] !== "v1" || segments[1] !== "relationship-repairs") return undefined;
	if (!context.geographyResolver) return problem(503, "Catalogue Unavailable", "Build the relationship candidate inventory before planning relationship repairs.");
	const repairs = context.geographyResolver.relationshipRepairs();
	return { status: 200, body: envelope(releaseId, {
		repairs,
		summary: repairs.reduce<Record<string, number>>((summary, repair) => ({ ...summary, [repair.action]: (summary[repair.action] ?? 0) + 1 }), {}),
		note: "Each item is evidence for a reviewed repair. Publishing a crosswalk still requires its own adapter, validation and release build.",
	}) };
};
