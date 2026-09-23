import { areaNotFound } from "./areaResources";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import { geographyResolverFor, type RouteRequest } from "./routing";

/** One compiled area identity in one explicit geography release. */
export const handleAreaIdentityRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 5 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas"
	)
		return undefined;
	const [geography, boundaryRelease, code] = segments.slice(2);
	if (!geography || !boundaryRelease || !code)
		return problem(400, "Invalid Path", "An area identity is incomplete.");
	const geographyResolver = geographyResolverFor(context);
	const area = geographyResolver.area({
		geography,
		boundaryRelease,
		code,
	});
	if (area)
		return {
			status: 200,
			body: envelope(releaseId, {
				id: `${geography}/${boundaryRelease}/${area.code}`,
				geography,
				boundaryRelease,
				...area,
			}),
		};
	return areaNotFound(context, geography, boundaryRelease, code);
};
