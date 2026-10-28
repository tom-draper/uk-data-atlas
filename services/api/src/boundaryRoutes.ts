import { requireGeography } from "@uk-data-atlas/atlas-runtime/api";
import { areaNotFound } from "@uk-data-atlas/atlas-runtime/areas";
import { releaseDownloads } from "@uk-data-atlas/atlas-runtime/maps";
import { withReleaseHeaders } from "./releaseDeprecation";
import { parseSelectionDate } from "@uk-data-atlas/atlas-runtime/areas";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import type { RouteRequest } from "@uk-data-atlas/atlas-runtime/areas";
import {
	choices,
	readChoice,
	readWholeNumber,
} from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "./queryRules";

const RESOLVE = QUERY_RULES["GET /boundary-releases:resolve"];
const COMPARE = QUERY_RULES["GET /boundary-releases:compare"];

/** Published boundary releases and the geography catalogues built from them. */
export const handleBoundaryRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const geographyResolver = context.geographyResolver;

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "geographies"
	) {
		const releasesByGeography = new Map<
			string,
			ReturnType<typeof geographyResolver.boundaryReleasesFor>
		>();
		for (const release of geographyResolver.boundaryReleasesFor()) {
			const releases = releasesByGeography.get(release.geography) ?? [];
			releases.push(release);
			releasesByGeography.set(release.geography, releases);
		}
		const geographies = [...releasesByGeography.entries()]
			.map(([id, releases]) => ({
				id,
				latestRelease: (
					releases.find((release) => !release.deprecation) ??
					releases[0]!
				).id,
				releaseCount: releases.length,
			}))
			.sort((left, right) => left.id.localeCompare(right.id));
		return { status: 200, body: envelope(releaseId, geographies) };
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "boundary-releases:resolve"
	) {
		const geography = parsedUrl.searchParams.get("geography");
		const date = parsedUrl.searchParams.get("date") ?? "";
		const country = parsedUrl.searchParams.get("country") ?? undefined;
		if (!geography)
			return invalidQuery(
				"geography is required, such as geography=ward.",
			);
		const selectionDate = parseSelectionDate(date);
		if (!selectionDate)
			return invalidQuery(
				"date must be a calendar date as YYYY-MM-DD, or a month as YYYY-MM.",
			);
		if (
			country !== undefined &&
			readChoice(country, RESOLVE.country) === null
		)
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
					? { links: { geographies: "/v1/geographies" } }
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
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "boundary-releases:compare"
	) {
		const geography = parsedUrl.searchParams.get("geography")?.trim();
		const from = parsedUrl.searchParams.get("from")?.trim();
		const to = parsedUrl.searchParams.get("to")?.trim();
		const limit = readWholeNumber(
			parsedUrl.searchParams.get("limit"),
			COMPARE.limit,
		);
		if (!geography || !from || !to)
			return invalidQuery(
				"geography, from and to are required boundary release ids.",
			);
		if (limit === null)
			return invalidQuery(
				`limit must be an integer from ${COMPARE.limit.minimum} to ${COMPARE.limit.maximum}.`,
			);
		if (from === to)
			return invalidQuery(
				"from and to must name different boundary releases.",
			);
		const unavailable = requireGeography(geographyResolver, "areas");
		if (unavailable) return unavailable;
		if (!geographyResolver.hasAreaRelease(geography, from))
			return areaNotFound(context, geography, from);
		if (!geographyResolver.hasAreaRelease(geography, to))
			return areaNotFound(context, geography, to);
		const comparison = geographyResolver.compareBoundaryReleases(
			geography,
			from,
			to,
			limit,
		);
		if (!comparison)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the compiled area identities before comparing boundary releases.",
			);
		return {
			status: 200,
			body: envelope(releaseId, {
				...comparison,
				limit,
				note: "Code-set differences are reported as identifiers present in only one release, not as proof that a place was added or removed. Extent continuity is available only where a dedicated geometric comparison published it; changed, indeterminate and unmeasured extents remain evidence for review rather than a conversion claim.",
			}),
		};
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "boundary-releases"
	)
		return {
			status: 200,
			body: envelope(releaseId, geographyResolver.boundaryReleasesFor()),
		};

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "boundary-releases"
	) {
		const release = geographyResolver.boundaryRelease(
			segments[2]!,
			segments[3]!,
		);
		if (release)
			return {
				status: 200,
				body: envelope(releaseId, {
					...release,
					documents: {
						validation: "/v1/documents/validation-report.json",
						health: "/v1/documents/geography-health.json",
					},
					downloads: releaseDownloads(
						context.mapResources,
						release.geography,
						release.id,
					),
				}),
			};
		return areaNotFound(context, segments[2], segments[3]);
	}

	return undefined;
};
