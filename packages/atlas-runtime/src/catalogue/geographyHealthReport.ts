import { releaseKey } from "@uk-data-atlas/geography";
import type { GeographyResolver } from "../areas/geographyResolver";

export const geographyHealthReport = (
	geographyResolver: Pick<GeographyResolver, "geographyHealth">,
	{
		geography,
		country,
		reach,
	}: {
		geography: string | null;
		country: string | null;
		reach: string | null;
	},
) => {
	const releases = geographyResolver
		.geographyHealth()
		.filter(
			(release) =>
				(!geography || release.geography === geography) &&
				(!country || release.countries.includes(country)) &&
				(!reach || release.reach.status === reach),
		);
	const priority = {
		"not-built": 0,
		unsupported: 1,
		partial: 2,
		available: 3,
	} as const;
	// A release every area has a relationship on can still convert onto
	// nothing, so where it can carry data is ranked before how complete its
	// relationships are.
	const reachPriority = {
		isolated: 0,
		"vintage-only": 1,
		connected: 2,
	} as const;
	const priorities = [...releases]
		.sort(
			(left, right) =>
				reachPriority[left.reach.status] -
					reachPriority[right.reach.status] ||
				priority[left.status] - priority[right.status] ||
				right.gapCount - left.gapCount ||
				releaseKey(left.geography, left.boundaryRelease).localeCompare(
					releaseKey(right.geography, right.boundaryRelease),
				),
		)
		.map((release) => ({
			...release,
			href: `/v1/relationships?geography=${release.geography}&release=${release.boundaryRelease}`,
		}));
	const countBy = <Key extends string>(
		key: (release: (typeof releases)[number]) => Key,
	) =>
		releases.reduce<Record<string, number>>(
			(summary, release) => ({
				...summary,
				[key(release)]: (summary[key(release)] ?? 0) + 1,
			}),
			{},
		);
	return {
		filters: { geography, country, reach },
		releases,
		priorities,
		priorityNote:
			"Releases that convert onto nothing rank first, then those reaching only other vintages of their own geography, then unbuilt relationships, releases with no evidence, and the largest partial coverage gaps.",
		summary: countBy((release) => release.status),
		reachSummary: countBy((release) => release.reach.status),
		reachNote:
			"`status` counts how many areas carry a published relationship. `reach` answers a different question: whether a published path converts this release onto another geography at all. A release can be complete on the first and isolated on the second.",
	};
};
