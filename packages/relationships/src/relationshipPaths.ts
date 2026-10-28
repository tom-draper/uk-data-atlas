import type { CrosswalkInventory, CrosswalkMethod } from "./crosswalkInventory";

export type RelationshipPurpose = "identity" | "membership" | "apportion";

export type RelationshipPath = {
	id: string;
	purpose: RelationshipPurpose;
	from: { geography: string; boundaryRelease: string };
	to: { geography: string; boundaryRelease: string };
	quality: "publisher-supplied" | "derived";
	/**
	 * `crosswalk` is one published crosswalk in either direction, `declared`
	 * a reviewed composition, and `discovered` a composition the build's path
	 * search found under the composition rules.
	 */
	origin: "crosswalk" | "declared" | "discovered";
	steps: Array<{
		crosswalkId: string;
		direction: "forward" | "reverse";
		method: CrosswalkMethod;
		/** What this step contributes, which can differ from the path's. */
		purpose: RelationshipPurpose;
	}>;
};

/**
 * Whether each source code of a crosswalk reaches exactly one target in each
 * direction, which decides whether a step can carry an identity or a sum.
 */
export type CrosswalkShape = { forward: boolean; reverse: boolean };

/** The build's path search: the shape of each crosswalk, and a step limit. */
export type RelationshipPathDiscovery = {
	shapes: Map<string, CrosswalkShape>;
	maximumSteps: number;
};

export type RelationshipPathInventory = {
	schemaVersion: 1;
	contentHash: string;
	crosswalkInventoryHash: string;
	paths: RelationshipPath[];
};

export type ApprovedRelationshipPath = {
	id: string;
	purpose: RelationshipPurpose;
	steps: Array<{ crosswalkId: string; direction: "forward" | "reverse" }>;
};

/** The purpose a crosswalk declares, or the one its method implies. */
export const relationshipPurposeFor = (
	crosswalk: Pick<
		CrosswalkInventory["crosswalks"][number],
		"method" | "relationshipPurpose"
	>,
): RelationshipPurpose | undefined =>
	crosswalk.relationshipPurpose ??
	(crosswalk.method === "official-lookup"
		? "identity"
		: crosswalk.method === "clean-containment" ||
			  crosswalk.method === "geometric-containment"
			? "membership"
			: crosswalk.method === "area-overlap" ||
				  crosswalk.method === "population-overlap"
				? "apportion"
				: crosswalk.method === "extent-continuity"
					? "identity"
					: undefined);

export const createRelationshipPathIndex = (
	inventory: RelationshipPathInventory,
) => {
	const index = new Map<string, RelationshipPath[]>();
	for (const path of inventory.paths) {
		const key = [
			path.from.geography,
			path.from.boundaryRelease,
			path.to.geography,
			path.to.boundaryRelease,
			path.purpose,
		].join("/");
		const paths = index.get(key) ?? [];
		paths.push(path);
		index.set(key, paths);
	}
	return index;
};
