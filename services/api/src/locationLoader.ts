import { readSqliteNamedLocationInventory } from "./atlasNamedLocations";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readAtlasPayload } from "../../../shared/atlasSqlite";
import type { CrosswalkInventory } from "./crosswalkInventory";
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
	const path = resolve(apiRoot, "../../data/build/atlas.sqlite");
	const inventory = JSON.parse(
		readAtlasPayload(
			resolve(apiRoot, "../.."),
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

/** Projections share the atlas database with their location and crosswalk inputs. */
export const createLocationProjectionStore = (
	apiRoot: string,
	inventory: LocationProjectionInventory,
) => {
	const path = resolve(apiRoot, "../../data/build/atlas.sqlite");
	if (!existsSync(path))
		throw new Error(
			`Missing ${path}. Run pnpm --dir ../.. data:build --only atlas-sqlite.`,
		);
	return new LocationProjectionDatabase(path, inventory);
};

export const createNamedLocations = (inventory: NamedLocationInventory) =>
	createNamedLocationLookup(inventory);
