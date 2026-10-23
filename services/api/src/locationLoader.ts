import { readSqliteNamedLocationInventory } from "./atlasNamedLocations";
import { existsSync, readFileSync } from "node:fs";
import type { CrosswalkInventory } from "./crosswalkInventory";
import {
	LOCATION_PROJECTION_DATABASE,
	LocationProjectionDatabase,
	type LocationProjectionInventory,
} from "./locationProjections";
import {
	createNamedLocationLookup,
	type NamedLocationInventory,
} from "./namedLocations";
import { publicPath, readPublicManifest } from "./publicManifest";

export const readNamedLocationInventory = readSqliteNamedLocationInventory;

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

/** The projections, read from the database the build writes beside them. */
export const createLocationProjectionStore = (
	apiRoot: string,
	inventory: LocationProjectionInventory,
) => {
	const path = publicPath(apiRoot, LOCATION_PROJECTION_DATABASE);
	if (!existsSync(path))
		throw new Error(
			`Missing ${LOCATION_PROJECTION_DATABASE}. Run pnpm --dir ../.. data:build --only location-projections.`,
		);
	return new LocationProjectionDatabase(path, inventory);
};

export const createNamedLocations = (inventory: NamedLocationInventory) =>
	createNamedLocationLookup(inventory);
