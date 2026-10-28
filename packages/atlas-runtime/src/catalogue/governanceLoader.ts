import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RelationshipCandidateInventory } from "../relationships/relationshipCandidates";
import { artifactRoot } from "../storage/dataLayout";

export const readRelationshipCandidateInventory = (
	apiRoot: string,
): RelationshipCandidateInventory => {
	const path = join(artifactRoot(apiRoot), "relationship-candidates.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as RelationshipCandidateInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.candidates)) {
		throw new Error(`Invalid relationship candidate inventory at ${path}`);
	}
	return inventory;
};
