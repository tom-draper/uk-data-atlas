import { explainAreaAbsence } from "./areaAbsence";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

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
	const area = context.areaLookup
		?.get(`${geography}/${boundaryRelease}`)
		?.get(code);
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
	const { detail, ...absence } = explainAreaAbsence(
		context.boundaryRegistry,
		context.areaInventory,
		context.areaLookup,
		geography,
		boundaryRelease,
		code,
	);
	return problem(404, "Not Found", detail, absence);
};
