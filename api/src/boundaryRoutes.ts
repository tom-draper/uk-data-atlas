import { areaNotFound } from "./areaResources";
import { parseSelectionDate } from "./releaseForDate";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import { geographyResolverFor, type RouteRequest } from "./routing";

/** Published boundary releases and the geography catalogues built from them. */
export const handleBoundaryRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const { boundaryRegistry, geographyInventory } = context;
	const geographyResolver = geographyResolverFor(context);

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "geographies"
	) {
		const releasesByGeography = new Map<
			string,
			typeof boundaryRegistry.releases
		>();
		for (const release of boundaryRegistry.releases) {
			const releases = releasesByGeography.get(release.geography) ?? [];
			releases.push(release);
			releasesByGeography.set(release.geography, releases);
		}
		const geographies = [...releasesByGeography.entries()]
			.map(([id, releases]) => ({
				id,
				latestRelease: releases[0]!.id,
				releaseCount: releases.length,
			}))
			.sort((left, right) => left.id.localeCompare(right.id));
		return { status: 200, body: envelope(releaseId, geographies) };
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "geography-inventory"
	) {
		return geographyInventory
			? { status: 200, body: envelope(releaseId, geographyInventory) }
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the geography inventory before starting the API.",
				);
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
			return problem(
				400,
				"Invalid Query",
				"geography is required, such as geography=ward.",
			);
		const selectionDate = parseSelectionDate(date);
		if (!selectionDate)
			return problem(
				400,
				"Invalid Query",
				"date must be a calendar date as YYYY-MM-DD, or a month as YYYY-MM.",
			);
		if (country !== undefined && !/^GB-(ENG|NIR|SCT|WLS)$/.test(country))
			return problem(
				400,
				"Invalid Query",
				"country must be one of GB-ENG, GB-NIR, GB-SCT or GB-WLS.",
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
		return {
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
		};
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "boundary-releases:compare"
	) {
		const geography = parsedUrl.searchParams.get("geography")?.trim();
		const from = parsedUrl.searchParams.get("from")?.trim();
		const to = parsedUrl.searchParams.get("to")?.trim();
		const limitText = parsedUrl.searchParams.get("limit");
		const limit = limitText === null ? 25 : Number(limitText);
		if (!geography || !from || !to)
			return problem(
				400,
				"Invalid Query",
				"geography, from and to are required boundary release ids.",
			);
		if (!Number.isInteger(limit) || limit < 1 || limit > 100)
			return problem(
				400,
				"Invalid Query",
				"limit must be an integer from 1 to 100.",
			);
		if (from === to)
			return problem(
				400,
				"Invalid Query",
				"from and to must name different boundary releases.",
			);
		const unavailable = geographyResolver.requires("areas");
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
				note: "Code-set differences are reported as identifiers present in only one release, not as proof that a place was added or removed. Same-code continuity is available only where a dedicated geometric comparison published it; changed, indeterminate and unmeasured extents remain evidence for review rather than a conversion claim.",
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
			body: envelope(releaseId, boundaryRegistry.releases),
		};

	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "boundary-releases"
	) {
		const release = boundaryRegistry.releases.find(
			(candidate) =>
				candidate.geography === segments[2] &&
				candidate.id === segments[3],
		);
		if (release) return { status: 200, body: envelope(releaseId, release) };
		return areaNotFound(context, segments[2], segments[3]);
	}

	return undefined;
};
