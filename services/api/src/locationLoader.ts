import { lazyValue } from "./lazyValue";
import type { NamedLocationGeometry } from "./namedLocationGeometry";
import { existsSync, readFileSync } from "node:fs";
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
import { readStoredText } from "./storedText";

export const readNamedLocationInventory = (
	apiRoot: string,
): NamedLocationInventory => {
	const packed = publicPath(apiRoot, "named-locations-metadata.json");
	if (!existsSync(packed))
		return readPublicManifest<NamedLocationInventory>(
			apiRoot,
			"named-locations.json",
			"locations",
			"named location inventory",
		);
	const inventory = readPublicManifest<
		Omit<NamedLocationInventory, "locations"> & {
			locations: Array<
				NamedLocationInventory["locations"][number] & {
					geometryArtifact?: string;
				}
			>;
		}
	>(
		apiRoot,
		"named-locations-metadata.json",
		"locations",
		"named location metadata",
	);
	return {
		...inventory,
		locations: inventory.locations.map(
			({ geometryArtifact, ...location }) => {
				if (!geometryArtifact) return location;
				if (
					!/^location-geometries\/[a-f0-9]{64}\.json$/.test(
						geometryArtifact,
					)
				)
					throw new Error("Invalid location geometry artifact");
				const path = publicPath(apiRoot, geometryArtifact);
				if (!existsSync(path))
					throw new Error(`Missing location geometry at ${path}`);
				const geometry = lazyValue(() => {
					const value: NamedLocationGeometry = JSON.parse(
						readFileSync(path, "utf8"),
					);
					if (
						!value.boundaryRelease ||
						!value.geometry ||
						!Array.isArray(value.bbox)
					)
						throw new Error(`Invalid location geometry at ${path}`);
					return value;
				});
				return {
					...location,
					get geometry() {
						return geometry();
					},
				};
			},
		),
	};
};

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
				readStoredText(path),
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
				readStoredText(path),
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
