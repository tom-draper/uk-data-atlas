import { areaNotFound } from "./areaResources";
import { parseSelectionDate } from "./releaseForDate";
import { problem, type ApiResponse } from "./routeResponse";
import type { RouteContext } from "./routing";

/**
 * The boundary release a name search is narrowed to: none, one pinned by id,
 * or the one current on a date. A date picks a release only by the rule it
 * states, and a month holding several releases that differ is refused with
 * all of them rather than one chosen.
 */
export type ReleaseChoice = {
	geography: string | null;
	boundaryRelease: string | null;
	/** How a date selected the release, for the response to show. */
	selection?: Record<string, unknown>;
};

export const chooseRelease = (
	context: RouteContext,
	parsedUrl: URL,
): ReleaseChoice | ApiResponse => {
	const geographyResolver = context.geographyResolver;
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
	if (!date) return { geography, boundaryRelease: requestedRelease };
	const selection = geographyResolver.selectReleaseForDate(
		geography!,
		date.month,
		country,
	);
	if (!selection)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the boundary registry in the geography resolver before selecting a release by date.",
		);
	if (selection.status === "none")
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
	if (selection.status === "ambiguous")
		return problem(
			409,
			"Ambiguous Release",
			`${selection.choices.length} ${geography} boundary releases are dated ${selection.month} and differ in more than coverage. Choose one by id; each is listed in choices.`,
			{ code: "ambiguous_release", choices: selection.choices },
		);
	const boundaryRelease = selection.selected.id;
	if (!geographyResolver.hasAreaRelease(geography!, boundaryRelease))
		return areaNotFound(context, geography!, boundaryRelease);
	return {
		geography,
		boundaryRelease,
		selection: {
			policy: "latest-release-dated-on-or-before" as const,
			date: date.date,
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
	};
};
