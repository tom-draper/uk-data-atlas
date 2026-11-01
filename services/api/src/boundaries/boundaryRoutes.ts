import type {
	RouteContextFor,
	RouteRequestFor,
	ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import { areaNotFound, envelope } from "@uk-data-atlas/atlas-runtime/api";
import { releaseDownloads } from "@uk-data-atlas/atlas-runtime/maps";
import { resolveBoundaryRelease } from "./resolveBoundaryRelease";
import { compareBoundaryReleases } from "./compareBoundaryReleases";

/** Published boundary releases and the geography catalogues built from them. */
export const listBoundaries = (
	context: RouteContextFor<"boundaryReleasesFor">,
	releaseId: string,
): ApiResponse => {
	const releasesByGeography = new Map<
		string,
		ReturnType<typeof context.geographyResolver.boundaryReleasesFor>
	>();
	for (const release of context.geographyResolver.boundaryReleasesFor()) {
		const releases = releasesByGeography.get(release.geography) ?? [];
		releases.push(release);
		releasesByGeography.set(release.geography, releases);
	}
	const geographies = [...releasesByGeography.entries()]
		.map(([id, releases]) => ({
			id,
			latestRelease: (
				releases.find((release) => !release.deprecation) ?? releases[0]!
			).id,
			releaseCount: releases.length,
		}))
		.sort((left, right) => left.id.localeCompare(right.id));
	return { status: 200, body: envelope(releaseId, geographies) };
};

export const listBoundaryReleases = (
	context: RouteContextFor<"boundaryReleasesFor">,
	releaseId: string,
): ApiResponse => ({
	status: 200,
	body: envelope(releaseId, context.geographyResolver.boundaryReleasesFor()),
});

export const handleBoundaryRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequestFor<
	| "boundaryRelease"
	| "boundaryReleasesFor"
	| "compareBoundaryReleases"
	| "hasAreaRelease"
	| "selectReleaseForDate"
	| "missingRequirement"
	| "explainAreaAbsence"
>): ApiResponse | undefined => {
	const geographyResolver = context.geographyResolver;

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "geographies"
	) {
		// The list used to be served here.
		return {
			status: 308,
			headers: { location: `/v1/boundaries${parsedUrl.search}` },
			body: envelope(releaseId, { href: "/v1/boundaries" }),
		};
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "boundaries"
	) {
		return listBoundaries(context, releaseId);
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "boundary-releases:resolve"
	) {
		return resolveBoundaryRelease({
			context,
			releaseId,
			parsedUrl,
		});
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "boundary-releases:compare"
	) {
		return compareBoundaryReleases({
			context,
			releaseId,
			parsedUrl,
		});
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "boundary-releases"
	)
		return listBoundaryReleases(context, releaseId);

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
