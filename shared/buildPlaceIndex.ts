import { rmSync } from "node:fs";
import { join } from "node:path";
import { publishCacheTables } from "./atlasCache";
import { readSqliteAreaInventory as readAreaInventory } from "./atlasAreaReader";
import { readAreaLookup } from "./areaLookup";
import { readSqliteNamedLocationInventory as readNamedLocationInventory } from "./atlasNamedLocationReader";
import { readGeographyCatalogue } from "./geographyCatalogue";
import type { BoundaryRegistry } from "./boundaryRegistry";
import { compilePlaceIndex, placeIndexTables } from "./placeIndex";

const readBoundaryRegistry = (apiRoot: string) =>
	readGeographyCatalogue<BoundaryRegistry>(
		apiRoot,
		"boundary-releases",
		"releases",
		"boundary registry",
	);

export const buildPlaceIndex = (repositoryRoot: string) => {
	const apiRoot = join(repositoryRoot, "services", "api");
	const areaInventory = readAreaInventory(apiRoot);
	const index = compilePlaceIndex(
		readAreaLookup(apiRoot, areaInventory),
		readNamedLocationInventory(apiRoot),
		areaInventory.contentHash,
		readBoundaryRegistry(apiRoot),
	);
	const outputPath = publishCacheTables(
		repositoryRoot,
		"place-index",
		placeIndexTables(index),
	);
	for (const filename of [
		"place-index.sqlite",
		"place-index.json",
		"place-index.json.gz",
	])
		rmSync(join(apiRoot, "public", filename), { force: true });

	return {
		outputPath,
		places: index.places.length,
		names: index.names.length,
	};
};
