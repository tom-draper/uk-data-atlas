import type {
	AreaOverlapTarget,
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";

/**
 * What it means for an area to be in a named location.
 *
 * A location is curated as a list of local authority codes, so anything else it
 * can be asked for has to come through a published crosswalk, and what the
 * answer means depends on which. `direct-code-match` is the location's own
 * codes. `fully-contained` comes from a clean-containment crosswalk, where the
 * publisher places each area wholly inside one parent, so membership is exact.
 * `weighted-overlap` comes from an area-overlap crosswalk, where an area can
 * straddle the boundary and belongs only in part.
 */
export type MembershipKind =
	"direct-code-match" | "fully-contained" | "weighted-overlap";

export type TraversedMember = {
	code: string;
	labels: string[];
	/** The member local authority this area was found through. */
	throughCode: string;
	/**
	 * For a weighted overlap, the share of this area lying in the parent it was
	 * matched on. Absent where containment makes the question meaningless.
	 */
	weight?: number;
	/** True when some of this area lies outside the location. */
	partial?: boolean;
};

export const membershipKindFor = (
	crosswalk: CrosswalkArtifact,
): MembershipKind =>
	crosswalk.method === "area-overlap"
		? "weighted-overlap"
		: "fully-contained";

/**
 * The crosswalks that could take a location's local authority members to the
 * geography and release asked for.
 *
 * A crosswalk runs from the finer geography to its parent, so the one wanted
 * here is the one whose `from` is what the caller asked for and whose `to` is a
 * local authority release. Listing them is what lets the caller be told which
 * to name rather than having one chosen for them.
 */
export const crosswalksTo = (
	inventory: CrosswalkInventory,
	geography: string,
	boundaryRelease: string,
	memberGeography: string,
) =>
	inventory.crosswalks.filter(
		(crosswalk) =>
			crosswalk.from.geography === geography &&
			crosswalk.from.boundaryRelease === boundaryRelease &&
			crosswalk.to.geography === memberGeography,
	);

const isOverlapTarget = (target: unknown): target is AreaOverlapTarget =>
	typeof (target as { weight?: unknown }).weight === "number";

/**
 * Every area in the crosswalk whose parent is one of the location's members.
 *
 * The crosswalk is read in its published direction and the parents filtered,
 * rather than a reverse index being built: the record already names the parent
 * each area belongs to, which is the fact being asked for.
 *
 * An area that a weighted crosswalk splits across the location's edge is
 * returned with the share that lies inside, and marked partial. A caller
 * drawing a map wants it; a caller summing a measure must not treat it as a
 * whole member, which is why the share travels with it.
 */
export const membersThroughCrosswalk = (
	crosswalk: CrosswalkArtifact,
	memberCodes: Set<string>,
): TraversedMember[] => {
	const found = new Map<string, TraversedMember>();
	for (const record of crosswalk.records) {
		for (const target of record.targets) {
			if (!memberCodes.has(target.code)) continue;
			const weight = isOverlapTarget(target) ? target.weight : undefined;
			const existing = found.get(record.source.code);
			// An area can meet more than one member of the same location; the
			// shares it holds in each of them add.
			found.set(record.source.code, {
				code: record.source.code,
				labels: record.source.labels,
				throughCode: existing?.throughCode ?? target.code,
				...(weight === undefined
					? {}
					: {
							weight: (existing?.weight ?? 0) + weight,
						}),
			});
		}
	}
	for (const member of found.values()) {
		if (member.weight !== undefined && member.weight < 0.999999) {
			member.partial = true;
		}
	}
	return [...found.values()].sort((left, right) =>
		left.code.localeCompare(right.code),
	);
};
