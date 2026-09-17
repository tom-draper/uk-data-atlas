import { areaNotFound, findArea, relationshipsFor } from "./areaResources";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Published direct containment relationships in either direction. */
export const handleAreaRelationshipRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 6 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas" ||
		!["parents", "children", "relationships"].includes(segments[5]!)
	)
		return undefined;
	const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
		string,
		string,
		string,
	];
	const { areaLookup, crosswalkLookup } = context;
	const area =
		context.geographyResolver?.area({
			geography,
			boundaryRelease,
			code,
		}) ?? findArea(areaLookup, geography, boundaryRelease, code);
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	if (!crosswalkLookup)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the crosswalk inventory before looking up area membership.",
		);
	const allRelationships =
		context.geographyResolver?.relationships({
			geography,
			boundaryRelease,
			code,
		}) ??
		relationshipsFor(
			undefined,
			crosswalkLookup,
			geography,
			boundaryRelease,
			code,
		);
	const relationships =
		segments[5] === "relationships"
			? allRelationships
			: allRelationships.filter(
					(candidate) =>
						candidate.relation ===
						(segments[5] === "parents" ? "within" : "contains"),
				);
	return {
		status: 200,
		body: envelope(releaseId, {
			id: `${geography}/${boundaryRelease}/${code}`,
			geography,
			boundaryRelease,
			...area,
			relationships,
		}),
	};
};
