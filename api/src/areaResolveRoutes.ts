import { areaNotFound } from "./areaResources";
import {
	derivedReleaseSources,
	parseSelectionDate,
	selectReleaseForDate,
} from "./releaseForDate";
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
	const requestedRelease =
		parsedUrl.searchParams.get("release")?.trim() || null;
	const dateText = parsedUrl.searchParams.get("date");
	const country = parsedUrl.searchParams.get("country") ?? undefined;
	if (requestedRelease && dateText)
		return problem(
			400,
			"Invalid Query",
			"release and date cannot be combined. Pin a release, or select one by date.",
		);
	if (dateText && !geography)
		return problem(
			400,
			"Invalid Query",
			"geography is required when resolving an area identifier by date.",
		);
	if (country !== undefined && !/^GB-(ENG|NIR|SCT|WLS)$/.test(country))
		return problem(
			400,
			"Invalid Query",
			"country must be one of GB-ENG, GB-NIR, GB-SCT or GB-WLS.",
		);
	const date = dateText === null ? undefined : parseSelectionDate(dateText);
	if (dateText !== null && !date)
		return problem(
			400,
			"Invalid Query",
			"date must be a calendar date as YYYY-MM-DD, or a month as YYYY-MM.",
		);
	const selection = date
		? selectReleaseForDate(
				context.boundaryRegistry,
				geography!,
				date.month,
				country,
				derivedReleaseSources(context.areaInventory),
			)
		: undefined;
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
