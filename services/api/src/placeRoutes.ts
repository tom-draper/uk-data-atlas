import { requireGeography } from "@uk-data-atlas/atlas-runtime/api";
import { describeCandidate } from "./placeResponses";
import { resolveAreaQuery } from "./areaResolveRoutes";
import { selectedAsOf } from "./locationRoutes";
import { postcodePlace } from "./postcodeRoutes";
import {
	envelope,
	invalidQuery,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import type { RouteRequest } from "@uk-data-atlas/atlas-runtime/areas";
import { readWholeNumber } from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "./queryRules";

const LIMIT = QUERY_RULES["GET /places"].limit;

/** Resolve an area code or place name without selecting one ambiguous meaning. */
export const handlePlaceRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "places"
	)
		return undefined;
	const query = parsedUrl.searchParams.get("q")?.trim();
	if (!query)
		return invalidQuery(
			"q is required: a place name, an area code, or a place reference such as localAuthority/E08000003.",
		);
	if (
		["geography", "release", "date", "country"].some((parameter) =>
			parsedUrl.searchParams.has(parameter),
		)
	)
		return resolveAreaQuery({
			context,
			releaseId,
			parsedUrl,
		});
	const limit = readWholeNumber(parsedUrl.searchParams.get("limit"), LIMIT);
	if (limit === null)
		return invalidQuery(
			`limit must be an integer between ${LIMIT.minimum} and ${LIMIT.maximum}.`,
		);
	const asOf = selectedAsOf(parsedUrl);
	if (typeof asOf !== "string" && asOf !== undefined) return asOf;
	const unavailable = requireGeography(context.geographyResolver, "places");
	if (unavailable) return unavailable;
	// A postcode is exactly one place, so it leads, and names fill the rest.
	const postcode = postcodePlace(context, query);
	const candidates = context.geographyResolver.places(
		query,
		postcode.candidate ? limit - 1 : limit,
		asOf,
	);
	return {
		status: 200,
		body: envelope(releaseId, {
			query,
			...(postcode.hint ? { postcodeHint: postcode.hint } : {}),
			candidates: [
				...(postcode.candidate ? [postcode.candidate] : []),
				...candidates.map((candidate) => ({
					...describeCandidate(candidate),
					boundaryReleases: candidate.boundaryReleases,
					...(candidate.memberCodes
						? { memberCodes: candidate.memberCodes }
						: {}),
					...(candidate.memberAssertions
						? { memberAssertions: candidate.memberAssertions }
						: {}),
					...(candidate.memberGeography
						? { memberGeography: candidate.memberGeography }
						: {}),
					...(candidate.definitionRevision
						? { definitionRevision: candidate.definitionRevision }
						: {}),
					...(candidate.validity
						? { validity: candidate.validity }
						: {}),
				})),
			],
			note: "Candidates are every place the name could mean, exact matches first and then names beginning with it. A unit postcode leads as a place of its own, placed in areas by the route at its href. Equal matches are listed headline geographies first, a presentation order that asserts nothing about which was meant. Pass a candidate's place reference to a value request to ask about that place alone.",
		}),
	};
};
