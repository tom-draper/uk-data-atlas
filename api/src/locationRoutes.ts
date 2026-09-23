import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { COVERS_MINIMUM_SHARE } from "./locationMembership";
import { notBuilt, unsupported } from "./capability";

const requirementDetail = (response: ApiResponse | undefined) =>
	response && "detail" in response.body ? response.body.detail : "Catalogue data is unavailable.";

/** Discovery endpoints for the Atlas's curated named locations. */
export const handleLocationRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "locations"
	) {
		const unavailable = context.geographyResolver.requires("named-locations");
		if (unavailable) return unavailable;
		const namedLocations = context.geographyResolver.namedLocations();
		const query = parsedUrl.searchParams
			.get("q")
			?.trim()
			.toLocaleLowerCase();
		const locations = namedLocations.filter(
			(location) =>
				!query ||
				location.id.startsWith(query) ||
				location.label.toLocaleLowerCase().startsWith(query),
		);
		return { status: 200, body: envelope(releaseId, locations) };
	}
	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "locations"
	) {
		const location = context.geographyResolver.namedLocation(segments[2]!);
		return location
			? { status: 200, body: envelope(releaseId, location) }
			: problem(
					404,
					"Not Found",
					"No named location matches that identity.",
				);
	}
	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "locations" &&
		segments[3] === "capabilities"
	)
		return locationCapabilities({ context, releaseId, segments });
	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "locations" &&
		segments[3] === "members"
	) {
		const location = context.geographyResolver.namedLocation(segments[2]!);
		if (!location)
			return problem(
				404,
				"Not Found",
				"No named location matches that identity.",
			);
		const memberGeography = location.memberGeography;
		const geography =
			parsedUrl.searchParams.get("geography") ?? memberGeography;
		const boundaryRelease = parsedUrl.searchParams.get("release");
		if (!boundaryRelease)
			return problem(
				400,
				"Invalid Query",
				"release is required to resolve a named location's members.",
			);
		const geographyResolver = context.geographyResolver;
		const areas = geographyResolver.releaseAreas(geography, boundaryRelease);
		if (!areas)
			return problem(
				404,
				"Not Found",
				"No compiled area release matches the requested member geography and release.",
			);
		if (geography === memberGeography) {
			const members = location.memberCodes.flatMap((code) => {
				const area = areas.get(code);
				return area
					? [
							{
								id: `${geography}/${boundaryRelease}/${code}`,
								...area,
							},
						]
					: [];
			});
			const resolvedCodes = new Set(members.map((member) => member.code));
			return {
				status: 200,
				body: envelope(releaseId, {
					location,
					composition: {
						kind: "declared-member-composite",
						officialGeography: false,
						status: resolvedCodes.size === location.memberCodes.length ? ("complete" as const) : ("partial" as const),
						note: "This is a curated composite of declared member codes, not an official administrative geography. Aggregate only measures whose semantics permit summing these members.",
					},
					geography,
					boundaryRelease,
					membership: "direct-code-match",
					members,
					unresolvedMemberCodes: location.memberCodes.filter(
						(code) => !resolvedCodes.has(code),
					),
					coverage: geographyResolver.reconcileMembers(
						geography,
						boundaryRelease,
						location.memberCodes,
						resolvedCodes,
					),
				}),
			};
		}
		const resolver = context.geographyResolver;
		const candidates = resolver.crosswalksToLocationMembers(
			geography,
			boundaryRelease,
			memberGeography,
		);
		const requested = parsedUrl.searchParams.get("via");
		if (!requested)
			return problem(
				400,
				"Invalid Query",
				candidates.length === 0
					? `A named location is curated as ${memberGeography} codes, and no published crosswalk maps ${geography}/${boundaryRelease} to a ${memberGeography} release, so its members cannot be resolved there.`
					: `Name the crosswalk to resolve members through, with via=. Published for ${geography}/${boundaryRelease}: ${candidates.map((candidate) => `${candidate.id} (${candidate.method}, to ${candidate.to.boundaryRelease})`).join("; ")}.`,
			);
		const summary = candidates.find(
			(candidate) => candidate.id === requested,
		);
		if (!summary)
			return problem(
				404,
				"Not Found",
				`No published crosswalk ${requested} maps ${geography}/${boundaryRelease} to a ${memberGeography} release.`,
			);
		const unavailable = resolver.requires("location-projections");
		if (unavailable) return unavailable;
		const projection = resolver.locationProjection(
			location.id,
			geography,
			boundaryRelease,
			requested,
		);
		if (!projection)
			return problem(
				503,
				"Catalogue Unavailable",
				`No materialised location projection is available through ${requested}. Rebuild the location projection inventory.`,
			);
		return {
			status: 200,
			body: envelope(releaseId, {
				location,
				composition: {
					kind: "declared-member-composite",
					officialGeography: false,
					status: projection.partialMembers > 0 ? ("partial" as const) : ("complete" as const),
					note: "This is a curated composite projected through a published crosswalk, not an official administrative geography. Partial members must not be summed as whole areas.",
				},
				geography,
				boundaryRelease,
				membership: projection.membership,
				membershipNote:
					projection.membership === "fully-contained"
						? "Each area is placed wholly inside one member by the publisher's own lookup, so membership is exact and no area is counted in part."
						: "Areas are matched by area overlap. One straddling the edge of the location is returned with the share of it that lies inside, and marked partial; it is not a whole member of this location.",
				via: projection.via,
				members: projection.members.map((member) => ({
					id: `${geography}/${boundaryRelease}/${member.code}`,
					...(areas.get(member.code) ?? {
						name: member.labels[0] ?? member.code,
					}),
					code: member.code,
					through: {
						id: `${projection.parentGeography}/${projection.parentBoundaryRelease}/${member.throughCode}`,
						code: member.throughCode,
					},
					relation: member.relation,
					...(member.weight === undefined
						? {}
						: { weight: member.weight }),
					...(member.partial ? { partial: true } : {}),
				})),
				partialMembers: projection.partialMembers,
				parentGeography: projection.parentGeography,
				parentBoundaryRelease: projection.parentBoundaryRelease,
				reach: projection.reach,
				coverage: projection.coverage,
			}),
		};
	}
	if (
		segments.length === 4 &&
		segments[0] === "v1" &&
		segments[1] === "locations" &&
		segments[3] === "parents"
	)
		return locationParents({ context, releaseId, parsedUrl, segments });
	return undefined;
};

/** Published direct and crosswalk views for a curated location definition. */
const locationCapabilities = ({
	context,
	releaseId,
	segments,
}: Pick<RouteRequest, "context" | "releaseId" | "segments">): ApiResponse => {
	const geographyResolver = context.geographyResolver;
	const location = geographyResolver.namedLocation(segments[2]!);
	if (!location)
		return problem(
			404,
			"Not Found",
			"No named location matches that identity.",
		);
	const areaAvailability = geographyResolver.requires("areas");
	const direct = areaAvailability
		? notBuilt(requirementDetail(areaAvailability))
		: (() => {
				const views = geographyResolver
					.locationReleaseViews(location.memberGeography, location.memberCodes)
					.map(({ geography, boundaryRelease, resolvedMemberCount }) => ({
						geography,
						boundaryRelease,
						status:
							resolvedMemberCount === location.memberCodes.length
								? ("available" as const)
								: ("partial" as const),
						memberCodeCount: location.memberCodes.length,
						resolvedMemberCount,
						href: `/v1/locations/${location.id}/members?release=${boundaryRelease}`,
					}));
				return views.length > 0
					? { status: "available" as const, views }
					: unsupported(
							`No compiled ${location.memberGeography} release is available for this location.`,
						);
			})();
	const memberAvailability = geographyResolver.requires("location-projections");
	const members = memberAvailability
		? notBuilt(
				requirementDetail(memberAvailability),
			)
		: (() => {
				const views = geographyResolver
					.locationMemberProjectionShards(location.memberGeography)
					.map(({ shard, summary }) => ({
						geography: shard.geography,
						boundaryRelease: shard.boundaryRelease,
						via: {
							id: summary.id,
							method: summary.method,
							quality: summary.quality,
						},
						href: `/v1/locations/${location.id}/members?geography=${shard.geography}&release=${shard.boundaryRelease}&via=${summary.id}`,
					}));
				return views.length > 0
					? { status: "available" as const, views }
					: unsupported(
							`No published crosswalk projection reaches this location's ${location.memberGeography} members.`,
						);
			})();
	const parentAvailability = geographyResolver.requires("location-projections");
	const parents = parentAvailability
		? notBuilt(
				requirementDetail(parentAvailability),
			)
		: (() => {
				const views = geographyResolver
					.locationParentProjectionShards(location.memberGeography)
					.map(({ shard, summary }) => ({
						geography: shard.geography,
						boundaryRelease: shard.boundaryRelease,
						via: {
							id: summary.id,
							method: summary.method,
							quality: summary.quality,
						},
						href: `/v1/locations/${location.id}/parents?geography=${shard.geography}&release=${shard.boundaryRelease}&via=${summary.id}`,
					}));
				return views.length > 0
					? { status: "available" as const, views }
					: unsupported(
							`No published parent projection starts from this location's ${location.memberGeography} members.`,
						);
			})();
	return {
		status: 200,
		body: envelope(releaseId, {
			location,
			capabilities: { direct, members, parents },
		}),
	};
};

const RELATION_RULE = `A parent is covered when the location takes in all of it: for a containment lookup, every area the publisher places in the parent is a member; for an area-overlap crosswalk, the members cover at least ${COVERS_MINIMUM_SHARE} of its area. Otherwise the location only intersects it. locationWithin names the single parent holding every member, and is null when members fall in several parents or any is placed in none.`;

/**
 * The areas of a coarser geography a named location lies in, covers or meets,
 * read from projections compiled over a crosswalk out of its member geography.
 */
const locationParents = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: Pick<
	RouteRequest,
	"context" | "releaseId" | "parsedUrl" | "segments"
>): ApiResponse => {
	const geographyResolver = context.geographyResolver;
	const location = geographyResolver.namedLocation(segments[2]!);
	if (!location)
		return problem(
			404,
			"Not Found",
			"No named location matches that identity.",
		);
	const geography = parsedUrl.searchParams.get("geography");
	const boundaryRelease = parsedUrl.searchParams.get("release");
	if (!geography || !boundaryRelease)
		return problem(
			400,
			"Invalid Query",
			"geography and release are required to find the areas a location lies in.",
		);
	const candidates = geographyResolver.locationParentCrosswalks(
		geography,
		boundaryRelease,
	);
	const requested = parsedUrl.searchParams.get("via");
	if (!requested)
		return problem(
			400,
			"Invalid Query",
			candidates.length === 0
				? `No published crosswalk runs from ${location.memberGeography} to ${geography}/${boundaryRelease}, so a location's parents there cannot be resolved.`
				: `Name the crosswalk to resolve parents through, with via=. Published for ${geography}/${boundaryRelease}: ${candidates.map((candidate) => candidate.crosswalkId).join("; ")}.`,
		);
	const projection = candidates.some(
		(candidate) => candidate.crosswalkId === requested,
	)
		? geographyResolver.locationParents(location.id, requested)
		: undefined;
	if (!projection)
		return problem(
			404,
			"Not Found",
			`No published crosswalk ${requested} runs from ${location.memberGeography} to ${geography}/${boundaryRelease}.`,
		);
	const parentAreas = geographyResolver.releaseAreas(geography, boundaryRelease);
	const memberAreas = geographyResolver.releaseAreas(
		projection.memberGeography,
		projection.memberBoundaryRelease,
	);
	const parentId = (code: string) =>
		`${geography}/${boundaryRelease}/${code}`;
	const memberId = (code: string) =>
		`${projection.memberGeography}/${projection.memberBoundaryRelease}/${code}`;
	return {
		status: 200,
			body: envelope(releaseId, {
				location,
				composition: {
					kind: "declared-member-composite",
					officialGeography: false,
					status: projection.unplaced.length > 0 ? ("partial" as const) : ("complete" as const),
					note: "This is a curated composite projected through a published crosswalk, not an official administrative geography. Partial members must not be summed as whole areas.",
				},
				geography,
			boundaryRelease,
			via: projection.via,
			memberGeography: projection.memberGeography,
			memberBoundaryRelease: projection.memberBoundaryRelease,
			relationRule: RELATION_RULE,
			locationWithin:
				projection.locationWithin === null
					? null
					: {
							id: parentId(projection.locationWithin),
							code: projection.locationWithin,
							name:
								parentAreas?.get(projection.locationWithin)
									?.name ?? projection.parents[0]?.labels[0],
						},
			parents: projection.parents.map((parent) => ({
				id: parentId(parent.code),
				code: parent.code,
				name: parentAreas?.get(parent.code)?.name ?? parent.labels[0],
				relation: parent.relation,
				members: parent.memberCodes.map((code) => ({
					id: memberId(code),
					code,
					name: memberAreas?.get(code)?.name ?? code,
				})),
				...(parent.parentMemberCount === undefined
					? {}
					: { parentMemberCount: parent.parentMemberCount }),
				...(parent.coveredShare === undefined
					? {}
					: { coveredShare: parent.coveredShare }),
			})),
			unplaced: projection.unplaced.map((code) => ({
				id: memberId(code),
				code,
				name: memberAreas?.get(code)?.name ?? code,
			})),
			coverage: projection.coverage,
		}),
	};
};
