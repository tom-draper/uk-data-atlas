import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

type ExactMatch = "code-exact" | "name-exact" | "alias-exact";

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
	const { geographyResolver } = context;
	if (!geographyResolver)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the geography resolver before resolving an area identifier.",
		);
	const geography = parsedUrl.searchParams.get("geography")?.trim() || null;
	const boundaryRelease =
		parsedUrl.searchParams.get("release")?.trim() || null;
	const areas = geographyResolver.searchAreas({
		geography,
		boundaryRelease,
	});
	const normalized = q.toLocaleLowerCase();
	const candidates = areas.flatMap((area) => {
		const matches: ExactMatch[] = [
			...(area.code.toLocaleLowerCase() === normalized
				? ["code-exact" as const]
				: []),
			...(area.name.toLocaleLowerCase() === normalized
				? ["name-exact" as const]
				: []),
			...(area.aliases?.some(
				(candidate) => candidate.toLocaleLowerCase() === normalized,
			)
				? ["alias-exact" as const]
				: []),
		];
		return matches.length > 0 ? [{ area, matches }] : [];
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
			candidates: candidates.map(({ area, matches }) => ({
				...area,
				matches,
				dossierHref: `/v1/areas/${area.geography}/${area.boundaryRelease}/${area.code}/dossier`,
			})),
			search: {
				href: `/v1/areas?${searchParams.toString()}`,
				note: "Use search for prefix matching when no exact official code, name or supplied alias resolves.",
			},
			note: "Candidates are every exact match within the requested filters. `matches` states whether the identifier matched an official code, name or supplied alias; this endpoint never chooses between geography or boundary-release candidates.",
		}),
	};
};
