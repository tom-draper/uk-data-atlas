import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RelationshipCandidateInventory } from "./relationshipCandidates";

export const readRelationshipCandidateInventory = (
	apiRoot: string,
): RelationshipCandidateInventory => {
	const path = join(apiRoot, "public", "relationship-candidates.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as RelationshipCandidateInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.candidates)) {
		throw new Error(`Invalid relationship candidate inventory at ${path}`);
	}
	return inventory;
};
