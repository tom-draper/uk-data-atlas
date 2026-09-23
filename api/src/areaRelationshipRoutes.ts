import { areaNotFound } from "./areaResources";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import { geographyResolverFor, type RouteRequest } from "./routing";

/** Published direct containment relationships in either direction. */
export const handleAreaRelationshipRoutes = ({
	context,
	releaseId,
	parsedUrl,
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
	const geographyResolver = geographyResolverFor(context);
	const area = geographyResolver.area({
		geography,
		boundaryRelease,
		code,
	});
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	if (!geographyResolver.hasAreaRelationships())
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the crosswalk inventory before looking up area membership.",
		);
	const allRelationships = geographyResolver.relationships({
		geography,
		boundaryRelease,
		code,
	});
	const relationships =
		segments[5] === "relationships"
			? allRelationships
			: allRelationships.filter(
					(candidate) =>
						candidate.relation ===
						(segments[5] === "parents" ? "within" : "contains"),
				);
	const depthParameter = parsedUrl.searchParams.get("depth");
	const depth = depthParameter === null ? undefined : Number(depthParameter);
	if (depth !== undefined && (!Number.isInteger(depth) || depth < 1 || depth > 20))
		return problem(400, "Invalid Query", "depth must be an integer from 1 to 20.");
	return {
		status: 200,
		body: envelope(releaseId, {
			id: `${geography}/${boundaryRelease}/${code}`,
			geography,
			boundaryRelease,
			...area,
			relationships,
			...(segments[5] === "parents" && depth !== undefined
				? { ancestors: geographyResolver.ancestorLineage({ geography, boundaryRelease, code }, depth) }
				: segments[5] === "children" && depth !== undefined
					? { descendants: geographyResolver.descendantLineage({ geography, boundaryRelease, code }, depth) }
				: {}),
		}),
	};
};
