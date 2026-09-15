import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { reconcileMembers } from "./memberReconciliation";
import {
	crosswalksTo,
	membersThroughCrosswalk,
	membershipKindFor,
} from "./locationMembership";

const MEMBER_GEOGRAPHY = "localAuthority";

/** Discovery endpoints for the Atlas's curated named locations. */
export const handleLocationRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const { namedLocationInventory, namedLocationLookup } = context;
	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "locations"
	) {
		if (!namedLocationInventory)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the named location inventory before listing locations.",
			);
		const query = parsedUrl.searchParams
			.get("q")
			?.trim()
			.toLocaleLowerCase();
		const locations = namedLocationInventory.locations.filter(
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
		const location = namedLocationLookup?.get(segments[2]!);
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
		segments[3] === "members"
	) {
		const location = namedLocationLookup?.get(segments[2]!);
		if (!location)
			return problem(
				404,
				"Not Found",
				"No named location matches that identity.",
			);
		const geography =
			parsedUrl.searchParams.get("geography") ?? MEMBER_GEOGRAPHY;
		const boundaryRelease = parsedUrl.searchParams.get("release");
		if (!boundaryRelease)
			return problem(
				400,
				"Invalid Query",
				"release is required to resolve a named location's members.",
			);
		const { areaLookup, crosswalkInventory, crosswalkLookup } = context;
		const areas = areaLookup?.get(`${geography}/${boundaryRelease}`);
		if (!areaLookup || !areas)
			return problem(
				404,
				"Not Found",
				"No compiled area release matches the requested member geography and release.",
			);
		if (geography === MEMBER_GEOGRAPHY) {
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
					geography,
					boundaryRelease,
					membership: "direct-code-match",
					members,
					unresolvedMemberCodes: location.memberCodes.filter(
						(code) => !resolvedCodes.has(code),
					),
					coverage: reconcileMembers(
						areaLookup,
						geography,
						boundaryRelease,
						location.memberCodes,
						resolvedCodes,
					),
				}),
			};
		}
		if (!crosswalkInventory || !crosswalkLookup)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the crosswalk inventory before resolving a named location into another geography.",
			);
		const candidates = crosswalksTo(
			crosswalkInventory,
			geography,
			boundaryRelease,
			MEMBER_GEOGRAPHY,
		);
		const requested = parsedUrl.searchParams.get("via");
		if (!requested)
			return problem(
				400,
				"Invalid Query",
				candidates.length === 0
					? `A named location is curated as ${MEMBER_GEOGRAPHY} codes, and no published crosswalk maps ${geography}/${boundaryRelease} to a ${MEMBER_GEOGRAPHY} release, so its members cannot be resolved there.`
					: `Name the crosswalk to resolve members through, with via=. Published for ${geography}/${boundaryRelease}: ${candidates.map((candidate) => `${candidate.id} (${candidate.method}, to ${candidate.to.boundaryRelease})`).join("; ")}.`,
			);
		const summary = candidates.find(
			(candidate) => candidate.id === requested,
		);
		const crosswalk = summary ? crosswalkLookup.get(requested) : undefined;
		if (!summary || !crosswalk)
			return problem(
				404,
				"Not Found",
				`No published crosswalk ${requested} maps ${geography}/${boundaryRelease} to a ${MEMBER_GEOGRAPHY} release.`,
			);
		const parentRelease = crosswalk.to.boundaryRelease;
		const parents =
			areaLookup.get(`${MEMBER_GEOGRAPHY}/${parentRelease}`) ?? new Map();
		const parentCodes = new Set(
			location.memberCodes.filter((code) => parents.has(code)),
		);
		const traversed = membersThroughCrosswalk(crosswalk, parentCodes);
		const kind = membershipKindFor(crosswalk);
		return {
			status: 200,
			body: envelope(releaseId, {
				location,
				geography,
				boundaryRelease,
				membership: kind,
				membershipNote:
					kind === "fully-contained"
						? "Each area is placed wholly inside one member by the publisher's own lookup, so membership is exact and no area is counted in part."
						: "Areas are matched by area overlap. One straddling the edge of the location is returned with the share of it that lies inside, and marked partial; it is not a whole member of this location.",
				via: {
					id: crosswalk.id,
					method: crosswalk.method,
					quality: crosswalk.quality,
					weighting: crosswalk.weighting,
					from: crosswalk.from,
					to: crosswalk.to,
					contentHash: summary.contentHash,
				},
				members: traversed.map((member) => ({
					id: `${geography}/${boundaryRelease}/${member.code}`,
					code: member.code,
					...(areas.get(member.code) ?? {
						name: member.labels[0] ?? member.code,
					}),
					through: {
						id: `${MEMBER_GEOGRAPHY}/${parentRelease}/${member.throughCode}`,
						code: member.throughCode,
					},
					...(member.weight === undefined
						? {}
						: { weight: member.weight }),
					...(member.partial ? { partial: true } : {}),
				})),
				partialMembers: traversed.filter((member) => member.partial)
					.length,
				parentGeography: MEMBER_GEOGRAPHY,
				parentBoundaryRelease: parentRelease,
				coverage: reconcileMembers(
					areaLookup,
					MEMBER_GEOGRAPHY,
					parentRelease,
					location.memberCodes,
					parentCodes,
				),
			}),
		};
	}
	return undefined;
};
