import { problem, type ApiResponse } from "./routeResponse";
import type { RouteContext } from "./routing";

/**
 * A 404 for an area identity that says why it resolves to nothing: an
 * unpublished geography or release, identities not compiled, or a code the
 * release does not hold, with the releases that do.
 */
export const areaNotFound = (
	context: RouteContext,
	geography?: string,
	boundaryRelease?: string,
	code?: string,
): ApiResponse => {
	const resolved = context.geographyResolver.explainAreaAbsence(
		geography ?? "",
		boundaryRelease ?? "",
		code ?? "",
	);
	const { detail, ...absence } = resolved ?? {
		detail: "No compiled boundary registry is available to explain this area identity.",
	};
	return problem(404, "Not Found", detail, absence);
};
