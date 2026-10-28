import { requireGeography } from "@uk-data-atlas/atlas-runtime/api";
import { areaNotFound } from "@uk-data-atlas/atlas-runtime/api";
import {
	envelope,
	invalidQuery,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import type { RouteRequest } from "@uk-data-atlas/atlas-runtime/areas";
import { areaKey } from "@uk-data-atlas/geography";
import { selectAreaChildren } from "./areaChildren";
import { readWholeNumber } from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "./queryRules";

// Parents and children state the same depth, and neither defaults it.
const DEPTH =
	QUERY_RULES["GET /areas/{geography}/{release}/{code}/parents"].depth;

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
	const unavailable = requireGeography(geographyResolver, "relationships");
	if (unavailable) return unavailable;
	let relationships = geographyResolver.relationships(
		{ geography, boundaryRelease, code },
		segments[5] === "relationships"
			? undefined
			: segments[5] === "parents"
				? "within"
				: "contains",
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
			return invalidQuery(
				selected.error === "invalid"
					? "childGeography must be a geography or geography/release pair."
					: "No published contemporary child release matches childGeography.",
				{ choices: selected.choices },
			);
		relationships = selected.children;
		childSelection = selected.selection;
	}
	const depth = readWholeNumber(parsedUrl.searchParams.get("depth"), DEPTH);
	if (depth === null)
		return invalidQuery(
			`depth must be an integer from ${DEPTH.minimum} to ${DEPTH.maximum}.`,
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
