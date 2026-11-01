import type {
	RouteRequestFor,
	ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import {
	envelope,
	invalidQuery,
	problem,
	choices,
	readChoice,
} from "@uk-data-atlas/atlas-runtime/api";
import { parseSelectionDate } from "@uk-data-atlas/atlas-runtime/areas";
import { withReleaseHeaders } from "../releaseDeprecation";
import { QUERY_RULES } from "../queryRules";

const RESOLVE = QUERY_RULES["GET /boundary-releases:resolve"];

export const resolveBoundaryRelease = ({
	context,
	releaseId,
	parsedUrl,
}: Pick<
	RouteRequestFor<"selectReleaseForDate" | "boundaryRelease">,
	"context" | "releaseId" | "parsedUrl"
>): ApiResponse => {
	const geographyResolver = context.geographyResolver;
	const geography = parsedUrl.searchParams.get("geography");
	const date = parsedUrl.searchParams.get("date") ?? "";
	const country = parsedUrl.searchParams.get("country") ?? undefined;
	if (!geography)
		return invalidQuery("geography is required, such as geography=ward.");
	const selectionDate = parseSelectionDate(date);
	if (!selectionDate)
		return invalidQuery(
			"date must be a calendar date as YYYY-MM-DD, or a month as YYYY-MM.",
		);
	if (country !== undefined && readChoice(country, RESOLVE.country) === null)
		return invalidQuery(
			`country must be one of ${choices(RESOLVE.country)}.`,
		);
	const requestedMonth = selectionDate.month;
	const selection = geographyResolver.selectReleaseForDate(
		geography,
		requestedMonth,
		country,
	);
	if (!selection)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the geography resolver and boundary registry before selecting a release by date.",
		);
	if (selection.status === "none") {
		return problem(404, "Not Found", selection.detail, {
			code:
				selection.absence === "unknown-geography"
					? "unsupported_geography"
					: "no_release_for_date",
			absence: selection.absence,
			...(selection.absence === "unknown-geography"
				? { links: { boundaries: "/v1/boundaries" } }
				: {}),
			...(selection.earliest ? { earliest: selection.earliest } : {}),
			...(selection.undated.length > 0
				? { undated: selection.undated }
				: {}),
		});
	}
	if (selection.status === "ambiguous") {
		return problem(
			409,
			"Ambiguous Release",
			`${selection.choices.length} ${geography} boundary releases are dated ${selection.month} and differ in more than coverage. Choose one by id; each is listed in choices.`,
			{ code: "ambiguous_release", choices: selection.choices },
		);
	}
	const { status: _status, undated, ...selected } = selection;
	return withReleaseHeaders(
		{
			status: 200,
			body: envelope(releaseId, {
				geography,
				date,
				month: requestedMonth,
				...(country ? { country } : {}),
				...selected,
				...(undated.length > 0 ? { undated } : {}),
				basis: "latest-release-dated-on-or-before",
				note: "Releases are snapshots dated to a month, so this is the latest snapshot at the date asked for, not a statement of which boundaries were legally in force on it. A change after the selected release shows first in next. When sameMonth is true the date falls in the release's own month, and a change that month may lie either side of it.",
			}),
		},
		geographyResolver.boundaryRelease(geography, selection.selected.id),
	);
};
