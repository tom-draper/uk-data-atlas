import type { BoundaryRegistry } from "./boundaryRegistry";

type BoundaryRelease = BoundaryRegistry["releases"][number];

/** A release's month as `YYYY-MM`, from its id; undefined when it has none. */
export const releaseMonth = (id: string): string | undefined =>
	/^(\d{4}-(0[1-9]|1[0-2]))(?:-|$)/.exec(id)?.[1];

/**
 * The month a boundary snapshot represents. Releases with a year-only id use
 * the earliest month their registry metadata permits, rather than sorting by
 * the spelling of the id.
 */
export const boundaryReleaseMonth = (
	release: BoundaryRelease,
): string | undefined => {
	const coverage = /^(\d{4})(?:-(0[1-9]|1[0-2]))?(?:-|$)/.exec(
		release.temporalCoverage ?? "",
	);
	return (
		releaseMonth(release.id) ??
		(coverage ? `${coverage[1]}-${coverage[2] ?? "01"}` : undefined)
	);
};

/** Oldest first, with ids only breaking ties between equally dated snapshots. */
export const compareBoundaryReleases = (
	left: BoundaryRelease,
	right: BoundaryRelease,
) => {
	const leftMonth = boundaryReleaseMonth(left);
	const rightMonth = boundaryReleaseMonth(right);
	return (
		(leftMonth && rightMonth
			? leftMonth.localeCompare(rightMonth)
			: leftMonth
				? -1
				: rightMonth
					? 1
					: 0) || left.id.localeCompare(right.id)
	);
};
