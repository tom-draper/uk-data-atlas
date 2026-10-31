import { areaNotFound } from "@uk-data-atlas/atlas-runtime/api";
import {
	envelope,
	invalidQuery,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import type { RouteRequestFor } from "@uk-data-atlas/atlas-runtime/api";
import { areaKey } from "@uk-data-atlas/geography";
import { readWholeNumber } from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "../queryRules";

const DEPTH =
	QUERY_RULES["GET /areas/{geography}/{release}/{code}/history"].depth;

/** Published lineage links and explicitly qualified same-code continuity. */
export const handleAreaHistoryRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequestFor<"areaHistory" | "explainAreaAbsence">):
	ApiResponse | undefined => {
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
	const geographyResolver = context.geographyResolver;
	const depth = readWholeNumber(parsedUrl.searchParams.get("depth"), DEPTH);
	if (depth === null)
		return invalidQuery(
			`depth must be an integer from ${DEPTH.minimum} to ${DEPTH.maximum}.`,
		);
	const history = geographyResolver.areaHistory(
		{
			geography,
			boundaryRelease,
			code,
		},
		depth,
	);
	if (!history)
		return areaNotFound(context, geography, boundaryRelease, code);
	return {
		status: 200,
		body: envelope(releaseId, {
			id: areaKey(geography, boundaryRelease, code),
			geography,
			boundaryRelease,
			...history.area,
			relationships: history.relationships,
			lineage: history.lineage,
			sameCodeReleases: history.sameCodeReleases,
			note: "Lineage follows only published historical edges and never infers a connection from a reused code. equivalent-to is published only for extent continuity. Same-code continuity only reports that the identifier appears in another release; it does not assert unchanged geometry or an exact historical equivalent.",
		}),
	};
};
