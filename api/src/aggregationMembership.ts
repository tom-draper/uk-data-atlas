import type { AreaLookup } from "./areaInventory";
import type { CrosswalkArtifact } from "./crosswalkInventory";

/**
 * The canonical identity of a country code, from the newest compiled country
 * release. Countries are stable across releases, so the newest is a safe
 * choice, and the release is reported alongside the name.
 */
export const findCountryIdentity = (
	areaLookup: AreaLookup | undefined,
	code: string,
) => {
	const releases = [...(areaLookup?.keys() ?? [])]
		.filter((key) => key.startsWith("country/"))
		.sort()
		.reverse();
	for (const key of releases) {
		const area = areaLookup?.get(key)?.get(code);
		if (area) {
			const boundaryRelease = key.slice("country/".length);
			return {
				id: `country/${boundaryRelease}/${code}`,
				boundaryRelease,
				...area,
			};
		}
	}
	return undefined;
};

/**
 * How a crosswalk establishes that a source area belongs wholly to one target,
 * which is what an extensive sum over that target rests on.
 */
const MEMBERSHIP_CLAIMS = {
	"area-overlap": "verified-full-area-overlap",
	"clean-containment": "verified-clean-containment",
	"geometric-containment": "verified-geometric-containment",
	"official-lookup": "published-membership-lookup",
} as const;

export const membershipClaimFor = (crosswalk: CrosswalkArtifact) => {
	if (crosswalk.method === "official-lookup")
		return crosswalk.relationshipPurpose === "membership"
			? MEMBERSHIP_CLAIMS["official-lookup"]
			: undefined;
	return MEMBERSHIP_CLAIMS[
		crosswalk.method as keyof typeof MEMBERSHIP_CLAIMS
	];
};

/** The source areas a crosswalk puts wholly inside one target. */
export const fullMembership = (
	crosswalk: CrosswalkArtifact,
	targetCode: string,
) => {
	if (!membershipClaimFor(crosswalk)) return undefined;
	const reaches = (targets: { code: string }[]) =>
		targets.some((target) => target.code === targetCode);
	const { matched, members } =
		crosswalk.method === "area-overlap"
			? (() => {
					const matched = crosswalk.records.filter((record) =>
						reaches(record.targets),
					);
					return {
						matched: matched.length,
						members: matched.flatMap((record) => {
							const target = record.targets.find(
								(candidate) => candidate.code === targetCode,
							);
							return record.targets.length === 1 &&
								target &&
								record.source.coverage === 1 &&
								target.sourceShare === 1
								? [record.source.code]
								: [];
						}),
					};
				})()
			: (() => {
					const matched = crosswalk.records.filter((record) =>
						reaches(record.targets),
					);
					return {
						matched: matched.length,
						members: matched.flatMap((record) =>
							record.targets.length === 1
								? [record.source.code]
								: [],
						),
					};
				})();
	return {
		memberCodes: members,
		unsafeSourceCount: matched - members.length,
	};
};
