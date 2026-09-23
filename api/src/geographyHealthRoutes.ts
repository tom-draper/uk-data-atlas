import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

export const handleGeographyHealthRoutes = ({ context, releaseId, parsedUrl, segments }: RouteRequest): ApiResponse | undefined => {
	if (segments.length !== 2 || segments[0] !== "v1" || segments[1] !== "geography-health") return undefined;
	const geographyResolver = context.geographyResolver;
	const geography = parsedUrl.searchParams.get("geography");
	const country = parsedUrl.searchParams.get("country");
	const reach = parsedUrl.searchParams.get("reach");
	if (reach && !["connected", "vintage-only", "isolated"].includes(reach))
		return problem(400, "Invalid Query", "reach must be connected, vintage-only or isolated.");
	const releases = geographyResolver.geographyHealth().filter(
		(release) =>
			(!geography || release.geography === geography) &&
			(!country || release.countries.includes(country)) &&
			(!reach || release.reach.status === reach),
	);
	const priority = { "not-built": 0, unsupported: 1, partial: 2, available: 3 } as const;
	// A release every area has a relationship on can still convert onto
	// nothing, so where it can carry data is ranked before how complete its
	// relationships are.
	const reachPriority = { isolated: 0, "vintage-only": 1, connected: 2 } as const;
	const priorities = [...releases].sort((left, right) =>
		reachPriority[left.reach.status] - reachPriority[right.reach.status] ||
		priority[left.status] - priority[right.status] ||
		right.gapCount - left.gapCount ||
		`${left.geography}/${left.boundaryRelease}`.localeCompare(`${right.geography}/${right.boundaryRelease}`),
	).map((release) => ({
		...release,
		href: `/v1/relationship-coverage?geography=${release.geography}&release=${release.boundaryRelease}`,
	}));
	const countBy = <Key extends string>(key: (release: (typeof releases)[number]) => Key) =>
		releases.reduce<Record<string, number>>(
			(summary, release) => ({ ...summary, [key(release)]: (summary[key(release)] ?? 0) + 1 }),
			{},
		);
	return { status: 200, body: envelope(releaseId, {
		filters: { geography, country, reach },
		releases,
		priorities,
		priorityNote: "Releases that convert onto nothing rank first, then those reaching only other vintages of their own geography, then unbuilt relationships, releases with no evidence, and the largest partial coverage gaps.",
		summary: countBy((release) => release.status),
		reachSummary: countBy((release) => release.reach.status),
		reachNote: "`status` counts how many areas carry a published relationship. `reach` answers a different question: whether a published path converts this release onto another geography at all. A release can be complete on the first and isolated on the second.",
	}) };
};
