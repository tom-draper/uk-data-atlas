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
	/**
	 * `within` when the whole area lies inside the location, `partly-within`
	 * when only the share in `weight` does. The first is what a sum may count
	 * whole; the second is only ever apportioned.
	 */
	relation: "within" | "partly-within";
};

export const membershipKindFor = (
	crosswalk: CrosswalkArtifact,
): MembershipKind =>
	crosswalk.method === "area-overlap" ||
	crosswalk.method === "population-overlap"
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
				relation: "within",
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
			member.relation = "partly-within";
		}
	}
	return [...found.values()].sort((left, right) =>
		left.code.localeCompare(right.code),
	);
};

export type MemberReach = {
	/** The location's members that resolve in the crosswalk's parent release. */
	memberCount: number;
	/** Of those, how many the crosswalk places any area in. */
	reachedCount: number;
	/**
	 * Members the crosswalk says nothing about, typically because it covers
	 * fewer countries than the location spans. Areas under them are missing
	 * from the answer, not absent from the ground.
	 */
	unreached: string[];
	complete: boolean;
};

/** Which of the location's members a crosswalk has any area under. */
export const memberReach = (
	crosswalk: CrosswalkArtifact,
	memberCodes: Set<string>,
): MemberReach => {
	const reached = new Set<string>();
	for (const record of crosswalk.records)
		for (const target of record.targets)
			if (memberCodes.has(target.code)) reached.add(target.code);
	const unreached = [...memberCodes]
		.filter((code) => !reached.has(code))
		.sort();
	return {
		memberCount: memberCodes.size,
		reachedCount: reached.size,
		unreached,
		complete: unreached.length === 0,
	};
};

/** Share of a parent that must be covered before a location is said to cover it. */
export const COVERS_MINIMUM_SHARE = 0.99;

export type ParentRelation = {
	code: string;
	labels: string[];
	/**
	 * `covers` when the location takes in the whole parent, `intersects` when
	 * it takes in only part of it.
	 */
	relation: "covers" | "intersects";
	/** The location's members lying in this parent. */
	memberCodes: string[];
	/**
	 * For a containment lookup, every area the publisher places in the parent;
	 * `covers` means the location holds all of them.
	 */
	parentMemberCount?: number;
	/**
	 * For an area-overlap crosswalk, the share of the parent's area the
	 * location's members cover; `covers` means at least
	 * COVERS_MINIMUM_SHARE of it.
	 */
	coveredShare?: number;
};

export type ParentProjection = {
	parents: ParentRelation[];
	/**
	 * The one parent the whole location lies in, when there is one: every
	 * member is placed in it, and wholly so for an overlap. Null otherwise.
	 */
	locationWithin: string | null;
	/**
	 * Members the crosswalk places in no parent, such as Welsh districts in an
	 * English region lookup. A location with any is never within one parent.
	 */
	unplaced: string[];
};

/** Whether a crosswalk out of the member geography states belonging. */
export const isParentCrosswalk = (
	crosswalk: Pick<CrosswalkArtifact, "method" | "relationshipPurpose">,
) =>
	crosswalk.method === "clean-containment" ||
	crosswalk.method === "area-overlap" ||
	crosswalk.method === "population-overlap" ||
	crosswalk.relationshipPurpose === "membership";

/**
 * The parents a location reaches through a crosswalk running from its member
 * geography to a coarser one, such as local authority to region, and whether
 * it covers each or only meets it.
 */
export const parentsThroughCrosswalk = (
	crosswalk: CrosswalkArtifact,
	memberCodes: Set<string>,
): ParentProjection => {
	const byParent = new Map<
		string,
		{
			labels: string[];
			children: Set<string>;
			members: Set<string>;
			coveredShare: number;
			memberWeight: number;
		}
	>();
	const placedMembers = new Set<string>();
	for (const record of crosswalk.records) {
		const isMember = memberCodes.has(record.source.code);
		if (isMember) placedMembers.add(record.source.code);
		for (const target of record.targets) {
			const parent = byParent.get(target.code) ?? {
				labels: target.labels,
				children: new Set<string>(),
				members: new Set<string>(),
				coveredShare: 0,
				memberWeight: 0,
			};
			parent.children.add(record.source.code);
			if (isMember) {
				parent.members.add(record.source.code);
				if (isOverlapTarget(target)) {
					parent.coveredShare += target.targetShare;
					parent.memberWeight += target.weight;
				}
			}
			byParent.set(target.code, parent);
		}
	}
	const overlap =
		crosswalk.method === "area-overlap" ||
		crosswalk.method === "population-overlap";
	const parents = [...byParent]
		.filter(([, parent]) => parent.members.size > 0)
		.map(([code, parent]): ParentRelation => {
			const covers = overlap
				? parent.coveredShare >= COVERS_MINIMUM_SHARE
				: parent.members.size === parent.children.size;
			return {
				code,
				labels: parent.labels,
				relation: covers ? "covers" : "intersects",
				memberCodes: [...parent.members].sort(),
				...(overlap
					? {
							coveredShare:
								Math.round(
									Math.min(parent.coveredShare, 1) * 1e6,
								) / 1e6,
						}
					: { parentMemberCount: parent.children.size }),
			};
		})
		.sort((left, right) => left.code.localeCompare(right.code));
	const [only] = parents;
	const within =
		parents.length === 1 &&
		only &&
		placedMembers.size > 0 &&
		placedMembers.size === memberCodes.size &&
		(overlap
			? byParent.get(only.code)!.memberWeight >=
				placedMembers.size * COVERS_MINIMUM_SHARE
			: true);
	return {
		parents,
		locationWithin: within ? only!.code : null,
		unplaced: [...memberCodes]
			.filter((code) => !placedMembers.has(code))
			.sort(),
	};
};
