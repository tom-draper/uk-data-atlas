import { readSqliteNamedLocationInventory } from "./atlasNamedLocationReader.ts";
import { readCachePayload, requireAtlasCache } from "../storage/atlasCache.ts";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import {
	LocationProjectionDatabase,
	type LocationProjectionInventory,
} from "./locationProjections.ts";
import {
	createNamedLocationLookup,
	type NamedLocationInventory,
} from "./namedLocations.ts";

export const readNamedLocationInventory = readSqliteNamedLocationInventory;

export const readLocationProjectionInventory = (
	repositoryRoot: string,
	namedLocations: NamedLocationInventory,
	crosswalkInventory: CrosswalkInventory,
): LocationProjectionInventory => {
	const path = requireAtlasCache(repositoryRoot, "projections");
	const inventory = JSON.parse(
		readCachePayload(
			repositoryRoot,
			"projections",
			"location-projection-inventory",
		),
	) as LocationProjectionInventory;
	if (
		inventory.schemaVersion !== 1 ||
		!Array.isArray(inventory.shards) ||
		!Array.isArray(inventory.parentShards) ||
		inventory.namedLocationInventoryHash !== namedLocations.contentHash ||
		inventory.crosswalkInventoryHash !== crosswalkInventory.contentHash
	) {
		throw new Error(`Invalid location projection inventory at ${path}`);
	}
	return inventory;
};

export const createLocationProjectionStore = (
	repositoryRoot: string,
	inventory: LocationProjectionInventory,
) => {
	const path = requireAtlasCache(repositoryRoot, "projections");
	return new LocationProjectionDatabase(path, inventory);
};

export const createNamedLocations = (inventory: NamedLocationInventory) =>
	createNamedLocationLookup(inventory);
