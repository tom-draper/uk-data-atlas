import { areaNotFound } from "./areaResources";
import { parseSelectionDate } from "./releaseForDate";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "./routeResponse";
import type { RouteRequest } from "./routing";

type AreaQueryRequest = Pick<
	RouteRequest,
	"context" | "releaseId" | "parsedUrl"
>;

/**
 * Resolves one supplied identifier into every exact area identity it can mean,
 * for a `/places` search filtered to a geography, release, date or country.
 * It deliberately returns candidates, rather than selecting a geography or
 * boundary release from catalogue order.
 */
export const resolveAreaQuery = ({
	context,
	releaseId,
	parsedUrl,
}: AreaQueryRequest): ApiResponse => {
	const q = parsedUrl.searchParams.get("q")?.trim();
	if (!q)
		return invalidQuery(
			"q is required: an official area code, name or supplied alias.",
		);
	const geographyResolver = context.geographyResolver;
	const geography = parsedUrl.searchParams.get("geography")?.trim() || null;
	const requestedRelease =
		parsedUrl.searchParams.get("release")?.trim() || null;
	const dateText = parsedUrl.searchParams.get("date");
	const country = parsedUrl.searchParams.get("country") ?? undefined;
	if (requestedRelease && dateText)
		return invalidQuery(
			"release and date cannot be combined. Pin a release, or select one by date.",
		);
	if (dateText && !geography)
		return invalidQuery(
			"geography is required when resolving an area identifier by date.",
		);
	if (country !== undefined && !/^GB-(ENG|NIR|SCT|WLS)$/.test(country))
		return invalidQuery(
			"country must be one of GB-ENG, GB-NIR, GB-SCT or GB-WLS.",
		);
	const date = dateText === null ? undefined : parseSelectionDate(dateText);
	if (dateText !== null && !date)
		return invalidQuery(
			"date must be a calendar date as YYYY-MM-DD, or a month as YYYY-MM.",
		);
	const selection = date
		? geographyResolver.selectReleaseForDate(
				geography!,
				date.month,
				country,
			)
		: undefined;
	if (date && !selection)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the boundary registry in the geography resolver before selecting a release by date.",
		);
	if (selection?.status === "none")
		return problem(404, "Not Found", selection.detail, {
			code:
				selection.absence === "unknown-geography"
					? "unsupported_geography"
					: "no_release_for_date",
			absence: selection.absence,
			...(selection.absence === "unknown-geography"
				? { links: { geographies: "/v1/geographies" } }
				: {}),
			...(selection.earliest ? { earliest: selection.earliest } : {}),
			...(selection.undated.length > 0
				? { undated: selection.undated }
				: {}),
		});
	if (selection?.status === "ambiguous")
		return problem(
			409,
			"Ambiguous Release",
			`${selection.choices.length} ${geography} boundary releases are dated ${selection.month} and differ in more than coverage. Choose one by id; each is listed in choices.`,
			{ code: "ambiguous_release", choices: selection.choices },
		);
	const boundaryRelease = selection?.selected.id ?? requestedRelease;
	if (
		selection &&
		!geographyResolver.hasAreaRelease(geography!, boundaryRelease!)
	)
		return areaNotFound(context, geography!, boundaryRelease!);
	const unavailable = geographyResolver.requires("area-search");
	if (unavailable) return unavailable;
	const candidates = geographyResolver.resolveAreaCandidates({
		geography,
		boundaryRelease,
		query: q,
	});
	const searchParams = new URLSearchParams({ q });
	return {
		status: 200,
		body: envelope(releaseId, {
			query: {
				value: q,
				...(geography ? { geography } : {}),
				...(boundaryRelease ? { boundaryRelease } : {}),
			},
			...(selection
				? {
						selection: {
							policy: "latest-release-dated-on-or-before" as const,
							date: date!.date,
							...(country ? { country } : {}),
							selected: selection.selected,
							sameMonth: selection.sameMonth,
							previous: selection.previous,
							next: selection.next,
							setAside: selection.setAside,
							notCovering: selection.notCovering,
							...(selection.undated.length > 0
								? { undated: selection.undated }
								: {}),
							note: "Releases are snapshots dated to a month. The selected release is the latest dated on or before the requested date, not a claim about which boundaries were legally in force that day.",
						},
					}
				: {}),
			candidates: candidates.map(({ area, matches }) => ({
				...area,
				matches,
				dossierHref: `/v1/areas/${area.geography}/${area.boundaryRelease}/${area.code}?include=dossier`,
			})),
			search: {
				href: `/v1/places?${searchParams.toString()}`,
				note: "Use place search for prefix matching when no exact official code, name or supplied alias resolves.",
			},
			note: "Candidates are every exact match within the requested filters. `matches` says whether the identifier matched an official code, name or supplied alias, including when accents, punctuation or an administrative title were set aside; this endpoint never chooses between geography or boundary-release candidates.",
		}),
	};
};
