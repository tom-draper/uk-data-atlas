import { readFileSync } from "node:fs";
import type { CrosswalkInventory } from "./crosswalkInventory";
import {
	LocationProjectionStore,
	LocationProjectionArtifact,
	type LocationParentProjectionArtifact,
	type LocationProjectionInventory,
} from "./locationProjections";
import {
	createNamedLocationLookup,
	type NamedLocationInventory,
} from "./namedLocations";
import { publicPath, readPublicManifest } from "./publicManifest";

export const readNamedLocationInventory = (
	apiRoot: string,
): NamedLocationInventory =>
	readPublicManifest<NamedLocationInventory>(
		apiRoot,
		"named-locations.json",
		"locations",
		"named location inventory",
	);

export const readLocationProjectionInventory = (
	apiRoot: string,
	namedLocations: NamedLocationInventory,
	crosswalkInventory: CrosswalkInventory,
): LocationProjectionInventory => {
	const path = publicPath(apiRoot, "location-projection-inventory.json");
	const inventory = JSON.parse(
		readFileSync(path, "utf8"),
	) as LocationProjectionInventory;
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.shards) ||
		inventory.namedLocationInventoryHash !== namedLocations.contentHash ||
		inventory.crosswalkInventoryHash !== crosswalkInventory.contentHash
	) {
		throw new Error(`Invalid location projection inventory at ${path}`);
	}
	return inventory;
};

export const createLocationProjectionStore = (
	apiRoot: string,
	inventory: LocationProjectionInventory,
	namedLocations: NamedLocationInventory,
	crosswalkInventory: CrosswalkInventory,
) =>
	new LocationProjectionStore(
		inventory,
		(shard) => {
			const path = publicPath(apiRoot, shard.artifact);
			const artifact = JSON.parse(
				readFileSync(path, "utf8"),
			) as LocationProjectionArtifact;
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== shard.contentHash ||
				artifact.crosswalkId !== shard.crosswalkId ||
				artifact.namedLocationInventoryHash !==
					namedLocations.contentHash ||
				artifact.crosswalkInventoryHash !==
					crosswalkInventory.contentHash ||
				!Array.isArray(artifact.projections)
			) {
				throw new Error(`Invalid location projection shard at ${path}`);
			}
			return artifact;
		},
		(shard) => {
			const path = publicPath(apiRoot, shard.artifact);
			const artifact = JSON.parse(
				readFileSync(path, "utf8"),
			) as LocationParentProjectionArtifact;
			if (
				artifact.schemaVersion !== 1 ||
				artifact.contentHash !== shard.contentHash ||
				artifact.crosswalkId !== shard.crosswalkId ||
				artifact.namedLocationInventoryHash !==
					namedLocations.contentHash ||
				artifact.crosswalkInventoryHash !==
					crosswalkInventory.contentHash ||
				!Array.isArray(artifact.parentProjections)
			) {
				throw new Error(
					`Invalid location parent projection shard at ${path}`,
				);
			}
			return artifact;
		},
	);

export const createNamedLocations = (inventory: NamedLocationInventory) =>
	createNamedLocationLookup(inventory);
