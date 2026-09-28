import { describeCandidate } from "./placeResponses";
import { postcodePlace } from "./postcodeRoutes";
import { MAX_PAGE_SIZE, readPageSize } from "./pagination";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

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
		return problem(
			400,
			"Invalid Query",
			"q is required: a place name, an area code, or a place reference such as localAuthority/E08000003.",
		);
	const limit = readPageSize(parsedUrl.searchParams.get("limit"), 10);
	if (limit === undefined)
		return problem(
			400,
			"Invalid Query",
			`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`,
		);
	const unavailable = context.geographyResolver.requires("places");
	if (unavailable) return unavailable;
	// A postcode is exactly one place, so it leads, and names fill the rest.
	const postcode = postcodePlace(context, query);
	const candidates = context.geographyResolver.places(
		query,
		postcode.candidate ? limit - 1 : limit,
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
