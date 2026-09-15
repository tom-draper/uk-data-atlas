import { explainAreaAbsence } from "./areaAbsence";
import { createAreaRelationshipIndex } from "./areaRelationships";
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
	const {
		areaInventory,
		areaLookup,
		areaRelationshipIndex,
		boundaryRegistry,
		crosswalkLookup,
	} = context;
	const area = areaLookup?.get(`${geography}/${boundaryRelease}`)?.get(code);
	if (!area) {
		const { detail, ...absence } = explainAreaAbsence(
			boundaryRegistry,
			areaInventory,
			areaLookup,
			geography,
			boundaryRelease,
			code,
		);
		return problem(404, "Not Found", detail, absence);
	}
	if (!crosswalkLookup)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the crosswalk inventory before looking up area membership.",
		);
	const index =
		areaRelationshipIndex ??
		createAreaRelationshipIndex(crosswalkLookup.values());
	const allRelationships =
		index.get(`${geography}/${boundaryRelease}/${code}`) ?? [];
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
