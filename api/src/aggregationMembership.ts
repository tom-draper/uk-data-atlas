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

/**
 * A step a composed membership path may take: one that establishes
 * membership, or same-code continuity, whose records are published only where
 * a code's extent held and so carry an area onto itself in a later release.
 * An identity lookup is not one: it names a successor, not the same extent.
 */
const pathStepClaimFor = (crosswalk: CrosswalkArtifact) =>
	crosswalk.method === "same-code-continuity"
		? "verified-same-code-continuity"
		: membershipClaimFor(crosswalk);

/**
 * Each source code of one crosswalk, the codes its records reach, and the
 * single target it lies wholly within, where the record establishes that.
 */
const stepEdges = (crosswalk: CrosswalkArtifact) => {
	const edges = new Map<string, { reaches: string[]; whole?: string }>();
	for (const record of crosswalk.records) {
		const [only] = record.targets;
		const whole =
			record.targets.length === 1 &&
			only &&
			(crosswalk.method !== "area-overlap" ||
				("coverage" in record.source &&
					record.source.coverage === 1 &&
					"sourceShare" in only &&
					only.sourceShare === 1))
				? only.code
				: undefined;
		const reaches = record.targets.map((target) => target.code);
		const existing = edges.get(record.source.code);
		// A code with several records reaches all of them and lies wholly in
		// one target only if every record agrees on it.
		edges.set(
			record.source.code,
			existing
				? {
						reaches: [...existing.reaches, ...reaches],
						whole:
							existing.whole === whole ? whole : undefined,
					}
				: { reaches, whole },
		);
	}
	return edges;
};

/**
 * The source areas a chain of forward crosswalks puts wholly inside one
 * target. A source is a member only if every step carries it wholly into one
 * area and the last of those is the target; one that reaches the target any
 * other way, such as through a split, is counted as unsafe, because summing
 * it would claim all of a value only part of which belongs there.
 */
export const membershipThroughSteps = (
	crosswalks: readonly CrosswalkArtifact[],
	targetCode: string,
) => {
	const [first] = crosswalks;
	if (!first) return undefined;
	const edges = crosswalks.map(stepEdges);
	let matched = 0;
	const members: string[] = [];
	for (const record of first.records) {
		let reached = new Set([record.source.code]);
		let whole: string | undefined = record.source.code;
		for (const step of edges) {
			const next = new Set<string>();
			for (const code of reached)
				for (const target of step.get(code)?.reaches ?? []) next.add(target);
			reached = next;
			whole = whole === undefined ? undefined : step.get(whole)?.whole;
		}
		if (!reached.has(targetCode)) continue;
		matched += 1;
		if (whole === targetCode) members.push(record.source.code);
	}
	return { memberCodes: members, unsafeSourceCount: matched - members.length };
};

/** The source areas a crosswalk puts wholly inside one target. */
export const fullMembership = (
	crosswalk: CrosswalkArtifact,
	targetCode: string,
) =>
	membershipClaimFor(crosswalk)
		? membershipThroughSteps([crosswalk], targetCode)
		: undefined;

/**
 * Why a path establishes membership, step by step, or the first step that
 * does not. Every step must run forward and carry a membership claim or
 * same-code continuity: a reversed containment lists an area's parts, and no
 * other step says a whole area lies inside another.
 */
export const pathMembershipClaims = (
	steps: ReadonlyArray<{
		artifact: CrosswalkArtifact;
		direction: "forward" | "reverse";
	}>,
):
	| { claims: string[] }
	| { refusal: string } => {
	const claims: string[] = [];
	for (const [index, { artifact, direction }] of steps.entries()) {
		if (direction !== "forward")
			return {
				refusal: `Step ${index + 1} of the path runs ${artifact.id} in reverse, which lists an area's parts rather than the area each part belongs to.`,
			};
		const claim = pathStepClaimFor(artifact);
		if (!claim)
			return {
				refusal: `Step ${index + 1} of the path, the ${artifact.method} crosswalk ${artifact.id}, does not declare membership, so its records are conversion data rather than the parts of one area.`,
			};
		claims.push(claim);
	}
	return { claims };
};
