import { readSqliteNamedLocationInventory } from "../storage/atlasNamedLocationReader";
import { readCachePayload, requireAtlasCache } from "../storage/atlasCache";
import type { CrosswalkInventory } from "@uk-data-atlas/relationships";
import {
	LocationProjectionDatabase,
	type LocationProjectionInventory,
} from "./locationProjections";
import {
	createNamedLocationLookup,
	type NamedLocationInventory,
} from "./namedLocations";

export const readNamedLocationInventory = readSqliteNamedLocationInventory;

export const readLocationProjectionInventory = (
	apiRoot: string,
	namedLocations: NamedLocationInventory,
	crosswalkInventory: CrosswalkInventory,
): LocationProjectionInventory => {
	const path = requireAtlasCache(apiRoot, "projections");
	const inventory = JSON.parse(
		readCachePayload(
			apiRoot,
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
	apiRoot: string,
	inventory: LocationProjectionInventory,
) => {
	const path = requireAtlasCache(apiRoot, "projections");
	return new LocationProjectionDatabase(path, inventory);
};

export const createNamedLocations = (inventory: NamedLocationInventory) =>
	createNamedLocationLookup(inventory);
