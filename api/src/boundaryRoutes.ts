import { explainAreaAbsence } from "./areaAbsence";
import { selectReleaseForDate } from "./releaseForDate";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Published boundary releases and the geography catalogues built from them. */
export const handleBoundaryRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const { areaInventory, areaLookup, boundaryRegistry, geographyInventory } =
		context;

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
		const dateMatch = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(date);
		const year = Number(dateMatch?.[1]);
		const month = Number(dateMatch?.[2]);
		const day = dateMatch?.[3] === undefined ? 1 : Number(dateMatch[3]);
		const calendar = new Date(Date.UTC(year, month - 1, day));
		if (
			!dateMatch ||
			calendar.getUTCFullYear() !== year ||
			calendar.getUTCMonth() !== month - 1 ||
			calendar.getUTCDate() !== day
		)
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
		const derivedFrom = new Map(
			(areaInventory?.releases ?? []).flatMap((release) =>
				release.status === "available" && release.derivedFrom
					? [
							[
								`${release.geography}/${release.id}`,
								`${release.derivedFrom.source.geography}/${release.derivedFrom.source.boundaryRelease}`,
							] as const,
						]
					: [],
			),
		);
		const requestedMonth = date.slice(0, 7);
		const selection = selectReleaseForDate(
			boundaryRegistry,
			geography,
			requestedMonth,
			country,
			derivedFrom,
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
		const { detail, ...absence } = explainAreaAbsence(
			boundaryRegistry,
			areaInventory,
			areaLookup,
			segments[2] ?? "",
			segments[3] ?? "",
			"",
		);
		return problem(404, "Not Found", detail, absence);
	}

	return undefined;
};
