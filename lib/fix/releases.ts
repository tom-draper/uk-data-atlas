import type { BoundaryRelease, ReleaseRef } from "./types";

/**
 * When a release id says it was published, as a sortable "YYYY-MM". Ids open
 * with the year and usually the month (`2024-12-uk-bgc`); a year-only id
 * (`2022-sc-bfc`) sorts as January.
 */
export function releaseDate(releaseId: string): string {
	const match = /^(\d{4})(?:-(\d{2}))?/.exec(releaseId);
	if (!match) return "";
	return `${match[1]}-${match[2] ?? "01"}`;
}

/** Newest first. Same-month variants sort by id, so `-v5` beats `-v4`. */
export function compareReleasesNewestFirst(a: string, b: string): number {
	const byDate = releaseDate(b).localeCompare(releaseDate(a));
	return byDate !== 0 ? byDate : b.localeCompare(a);
}

export function releasesOf(
	releases: BoundaryRelease[],
	geography: string,
): BoundaryRelease[] {
	return releases
		.filter((release) => release.geography === geography)
		.sort((a, b) => compareReleasesNewestFirst(a.id, b.id));
}

/** The newest release of a geography, which "update" moves codes to. */
export function latestRelease(
	releases: BoundaryRelease[],
	geography: string,
): ReleaseRef | null {
	const newest = releasesOf(releases, geography)[0];
	return newest ? { geography, boundaryRelease: newest.id } : null;
}

export function findRelease(
	releases: BoundaryRelease[],
	ref: ReleaseRef,
): BoundaryRelease | undefined {
	return releases.find(
		(release) =>
			release.geography === ref.geography &&
			release.id === ref.boundaryRelease,
	);
}

/**
 * "Wards, December 2024" from "Wards, December 2024 (United Kingdom,
 * generalised, clipped)". Falls back to the ids when the release is unknown.
 */
export function releaseLabel(
	releases: BoundaryRelease[],
	ref: ReleaseRef,
): string {
	const release = findRelease(releases, ref);
	if (!release) return `${ref.geography} ${ref.boundaryRelease}`;
	return release.title.replace(/\s*\(.*\)\s*$/, "");
}

/** The release's own words for what makes it distinct, such as "Great Britain, generalised". */
export function releaseDetail(
	releases: BoundaryRelease[],
	ref: ReleaseRef,
): string | null {
	const release = findRelease(releases, ref);
	return release?.title.match(/\(([^)]*)\)\s*$/)?.[1] ?? null;
}

/** "Wards" from a release title, for talking about a geography in general. */
export function geographyLabel(
	releases: BoundaryRelease[],
	geography: string,
): string {
	const release = releases.find((entry) => entry.geography === geography);
	return release?.title.split(",")[0] ?? geography;
}

export const sameRelease = (a: ReleaseRef | null, b: ReleaseRef | null) =>
	!!a &&
	!!b &&
	a.geography === b.geography &&
	a.boundaryRelease === b.boundaryRelease;
