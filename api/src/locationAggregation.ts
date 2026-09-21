import type { AreaLookup } from "./areaInventory";
import { reconcileMembersForYear } from "./memberReconciliation";
import type { NamedLocation } from "./namedLocations";
import { problem, type ApiResponse } from "./routeResponse";

type LocationAggregate = {
	members: Array<{ areaCode: string }>;
	value: number;
	unresolvedMemberCodes: string[];
};

type LocationCoverage = ReturnType<typeof reconcileMembersForYear>;

/** Validate a named location against the source partition's area vintage. */
export const validateLocationAggregation = ({
	location,
	byLocation,
	areaLookup,
	sourceGeography,
}: {
	location?: NamedLocation;
	byLocation?: LocationAggregate;
	areaLookup?: AreaLookup;
	sourceGeography: { type: string; boundaryYear: number };
}): LocationCoverage | ApiResponse | undefined => {
	if (!location || !byLocation) return undefined;
	const locationCoverage = areaLookup
		? reconcileMembersForYear(
				areaLookup,
				sourceGeography.type,
				sourceGeography.boundaryYear,
				location.memberCodes,
				new Set(byLocation.members.map((record) => record.areaCode)),
			)
		: undefined;
	if (!areaLookup && byLocation.unresolvedMemberCodes.length > 0) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the area inventory before aggregating over a named location, so a member code of another vintage can be told from one that is wrong.",
		);
	}
	if (locationCoverage && locationCoverage.unexplained.length > 0) {
		return problem(
			422,
			"Operation Not Supported",
			`The named location does not cover this source partition by direct code match: ${locationCoverage.unexplained
				.map((member) => `${member.code} (${member.status})`)
				.join(", ")}. No conversion or partial sum was applied.`,
			{ code: "partial_coverage" },
		);
	}
	if (byLocation.members.length === 0) {
		if (location.memberCodes.length === 0) {
			return problem(
				422,
				"Operation Not Supported",
				`${location.label} carries no member codes: it names an extent rather than a set of areas. Aggregate a country with areaCode, such as areaCode=E92000001 for England.`,
			);
		}
		const resolvedElsewhere = [
			...new Set(
				(locationCoverage?.unresolved ?? []).flatMap(
					(member) => member.presentIn,
				),
			),
		].sort();
		return problem(
			422,
			"Operation Not Supported",
			`Every member code of ${location.label} is the wrong vintage for this source partition, which is on ${sourceGeography.boundaryYear} ${sourceGeography.type} codes${
				resolvedElsewhere.length > 0
					? `; they resolve against ${resolvedElsewhere.join(", ")}`
					: ""
			}. The place is no longer one of these areas in its own right.`,
		);
	}
	return locationCoverage;
};
