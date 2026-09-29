import { chooseRelease } from "./releaseChoice";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/**
 * Resolves one supplied identifier into every exact area identity it can mean.
 * It deliberately returns candidates, rather than selecting a geography or
 * boundary release from catalogue order.
 */
export const handleAreaResolveRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas:resolve"
	)
		return undefined;
	const q = parsedUrl.searchParams.get("q")?.trim();
	if (!q)
		return problem(
			400,
			"Invalid Query",
			"q is required: an official area code, name or supplied alias.",
		);
	const geographyResolver = context.geographyResolver;
	const choice = chooseRelease(context, parsedUrl);
	if ("status" in choice) return choice;
	const { geography, boundaryRelease, selection } = choice;
	const unavailable = geographyResolver.requires("area-search");
	if (unavailable) return unavailable;
	const candidates = geographyResolver.resolveAreaCandidates({
		geography,
		boundaryRelease,
		query: q,
	});
	const searchParams = new URLSearchParams({ q });
	if (geography) searchParams.set("geography", geography);
	if (boundaryRelease) searchParams.set("release", boundaryRelease);
	return {
		status: 200,
		body: envelope(releaseId, {
			query: {
				value: q,
				...(geography ? { geography } : {}),
				...(boundaryRelease ? { boundaryRelease } : {}),
			},
			...(selection ? { selection } : {}),
			candidates: candidates.map(({ area, matches }) => ({
				...area,
				matches,
				dossierHref: `/v1/areas/${area.geography}/${area.boundaryRelease}/${area.code}/dossier`,
			})),
			search: {
				href: `/v1/areas?${searchParams.toString()}`,
				note: "Use search for prefix matching when no exact official code, name or supplied alias resolves.",
			},
			note: "Candidates are every exact match within the requested filters. `matches` says whether the identifier matched an official code, name or supplied alias, including when accents, punctuation or an administrative title were set aside; this endpoint never chooses between geography or boundary-release candidates.",
		}),
	};
};
