import { readFileSync } from "node:fs";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { RelationshipPathInventory } from "./relationshipPaths";
import type { CrosswalkLookup } from "./routing";
import { publicPath, readPublicManifest } from "./publicManifest";

export const readCrosswalkInventory = (apiRoot: string): CrosswalkInventory =>
	readPublicManifest<CrosswalkInventory>(
		apiRoot,
		"crosswalk-inventory.json",
		"crosswalks",
		"crosswalk inventory",
	);

export const readCrosswalkLookup = (
	apiRoot: string,
	inventory: CrosswalkInventory,
): CrosswalkLookup =>
	new Map(
		inventory.crosswalks.map((crosswalk) => {
			const path = publicPath(apiRoot, crosswalk.artifact);
			const artifact = JSON.parse(
				readFileSync(path, "utf8"),
			) as CrosswalkArtifact;
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== crosswalk.contentHash ||
				!Array.isArray(artifact.records)
			) {
				throw new Error(`Invalid crosswalk artifact at ${path}`);
			}
			return [crosswalk.id, artifact];
		}),
	);

export const readRelationshipPathInventory = (
	apiRoot: string,
	crosswalks: CrosswalkInventory,
): RelationshipPathInventory => {
	const path = publicPath(apiRoot, "relationship-paths.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as RelationshipPathInventory;
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.paths) ||
		inventory.crosswalkInventoryHash !== crosswalks.contentHash
	) {
		throw new Error(`Invalid relationship path inventory at ${path}`);
	}
	return inventory;
};
