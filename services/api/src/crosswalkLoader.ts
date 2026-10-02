import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
	CrosswalkArtifact,
	CrosswalkInventory,
} from "./crosswalkInventory";
import type { RelationshipPathInventory } from "./relationshipPaths";
import type { CrosswalkLookup } from "./routing";

const publicPath = (apiRoot: string, filename: string) =>
	join(apiRoot, "public", filename);

export const readCrosswalkInventory = (apiRoot: string): CrosswalkInventory => {
	const path = publicPath(apiRoot, "crosswalk-inventory.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as CrosswalkInventory;
	if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.crosswalks)) {
		throw new Error(`Invalid crosswalk inventory at ${path}`);
	}
	return inventory;
};

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
