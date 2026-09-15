import { explainAreaAbsence } from "./areaAbsence";
import { createAreaRelationshipIndex } from "./areaRelationships";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Published predecessor/successor links and explicitly qualified same-code continuity. */
export const handleAreaHistoryRoutes = ({
	context,
	releaseId,
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
	const sameCodeReleases = [...(areaLookup?.entries() ?? [])]
		.flatMap(([identity, areas]) => {
			const [candidateGeography, candidateRelease] = identity.split(
				"/",
				2,
			);
			const candidate = areas.get(code);
			return candidateGeography === geography &&
				candidateRelease !== boundaryRelease &&
				candidate
				? [
						{
							id: `${identity}/${code}`,
							geography,
							boundaryRelease: candidateRelease!,
							...candidate,
							status: "same-code-continuity" as const,
						},
					]
				: [];
		})
		.sort((left, right) =>
			left.boundaryRelease.localeCompare(right.boundaryRelease),
		);
	const index =
		areaRelationshipIndex ??
		(crosswalkLookup
			? createAreaRelationshipIndex(crosswalkLookup.values())
			: undefined);
	const relationships = (
		index?.get(`${geography}/${boundaryRelease}/${code}`) ?? []
	).filter(
		(relationship) =>
			relationship.relation === "successor" ||
			relationship.relation === "predecessor",
	);
	return {
		status: 200,
		body: envelope(releaseId, {
			id: `${geography}/${boundaryRelease}/${code}`,
			geography,
			boundaryRelease,
			...area,
			relationships,
			sameCodeReleases,
			note: "Same-code continuity only reports that the identifier appears in another release; it does not assert unchanged geometry or an exact historical equivalent.",
		}),
	};
};
