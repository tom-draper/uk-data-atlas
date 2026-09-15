import {
	createPlaceIndex,
	resolvePlaces,
	type PlaceCandidate,
	type PlaceIndex,
} from "./placeResolver";
import { MAX_PAGE_SIZE, readPageSize } from "./pagination";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

const placeIndexes = new WeakMap<
	object,
	{ locations: unknown; index: PlaceIndex }
>();

const indexFor = (
	areaLookup: NonNullable<RouteRequest["context"]["areaLookup"]>,
	locations: RouteRequest["context"]["namedLocationInventory"],
) => {
	const cached = placeIndexes.get(areaLookup);
	if (cached && cached.locations === locations) return cached.index;
	const index = createPlaceIndex(areaLookup, locations);
	placeIndexes.set(areaLookup, { locations, index });
	return index;
};

const describe = (candidate: PlaceCandidate) => ({
	place: candidate.place,
	kind: candidate.kind,
	name: candidate.name,
	geography: candidate.geography,
	code: candidate.code,
	match: candidate.match,
	...(candidate.matchedLabel !== candidate.name
		? { matchedLabel: candidate.matchedLabel }
		: {}),
});

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
	if (!context.areaLookup)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the area inventory before resolving place names.",
		);
	const candidates = resolvePlaces(
		indexFor(context.areaLookup, context.namedLocationInventory),
		query,
		limit,
	);
	return {
		status: 200,
		body: envelope(releaseId, {
			query,
			candidates: candidates.map((candidate) => ({
				...describe(candidate),
				boundaryReleases: candidate.boundaryReleases,
				...(candidate.memberCodes
					? { memberCodes: candidate.memberCodes }
					: {}),
			})),
			note: "Candidates are every place the name could mean, exact matches first and then names beginning with it. Equal matches are listed headline geographies first, a presentation order that asserts nothing about which was meant. Pass a candidate's place reference to a value request to ask about that place alone.",
		}),
	};
};
