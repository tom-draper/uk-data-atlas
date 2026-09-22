import { areaNotFound } from "./areaResources";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Published predecessor/successor links and explicitly qualified same-code continuity. */
export const handleAreaHistoryRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 6 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas" ||
		segments[5] !== "history"
	)
		return undefined;
	const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
		string,
		string,
		string,
	];
	const { geographyResolver } = context;
	if (!geographyResolver)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the geography resolver before looking up area history.",
		);
	const depthParameter = parsedUrl.searchParams.get("depth");
	const depth = depthParameter === null ? 8 : Number(depthParameter);
	if (!Number.isInteger(depth) || depth < 1 || depth > 20)
		return problem(400, "Invalid Query", "depth must be an integer from 1 to 20.");
	const history = geographyResolver.areaHistory({
		geography,
		boundaryRelease,
		code,
	}, depth);
	if (!history) return areaNotFound(context, geography, boundaryRelease, code);
	return {
		status: 200,
		body: envelope(releaseId, {
			id: `${geography}/${boundaryRelease}/${code}`,
			geography,
			boundaryRelease,
			...history.area,
			relationships: history.relationships,
			lineage: history.lineage,
			sameCodeReleases: history.sameCodeReleases,
			note: "Lineage follows only published predecessor/successor edges and never infers a connection from a reused code. Same-code continuity only reports that the identifier appears in another release; it does not assert unchanged geometry or an exact historical equivalent.",
		}),
	};
};
