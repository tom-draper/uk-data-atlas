import { areaNotFound } from "./areaResources";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { areaKey } from "./geographyKeys";
import { selectAreaChildren } from "./areaChildren";

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
	const geographyResolver = context.geographyResolver;
	const area = geographyResolver.area({
		geography,
		boundaryRelease,
		code,
	});
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	const unavailable = geographyResolver.requires("relationships");
	if (unavailable) return unavailable;
	const allRelationships = geographyResolver.relationships({
		geography,
		boundaryRelease,
		code,
	});
	let relationships =
		segments[5] === "relationships"
			? allRelationships
			: allRelationships.filter(
					(candidate) =>
						candidate.relation ===
						(segments[5] === "parents" ? "within" : "contains"),
				);
	let childSelection: unknown;
	if (segments[5] === "children") {
		const selected = selectAreaChildren(
			context,
			boundaryRelease,
			relationships,
			parsedUrl.searchParams.get("childGeography"),
		);
		if ("error" in selected)
			return problem(
				400,
				"Invalid Query",
				selected.error === "invalid"
					? "childGeography must be a geography or geography/release pair."
					: "No published contemporary child release matches childGeography.",
				{ choices: selected.choices },
			);
		relationships = selected.children;
		childSelection = selected.selection;
	}
	const depthParameter = parsedUrl.searchParams.get("depth");
	const depth = depthParameter === null ? undefined : Number(depthParameter);
	if (
		depth !== undefined &&
		(!Number.isInteger(depth) || depth < 1 || depth > 20)
	)
		return problem(
			400,
			"Invalid Query",
			"depth must be an integer from 1 to 20.",
		);
	return {
		status: 200,
		body: envelope(releaseId, {
			id: areaKey(geography, boundaryRelease, code),
			geography,
			boundaryRelease,
			...area,
			relationships,
			...(childSelection ? { childSelection } : {}),
			...(segments[5] === "parents" && depth !== undefined
				? {
						ancestors: geographyResolver.ancestorLineage(
							{ geography, boundaryRelease, code },
							depth,
						),
					}
				: segments[5] === "children" && depth !== undefined
					? {
							descendants: geographyResolver.descendantLineage(
								{ geography, boundaryRelease, code },
								depth,
							),
						}
					: {}),
		}),
	};
};
