import { compileDuckdbPlaceIndex } from "./duckdbPlaceIndex.ts";
import { writeCacheTables } from "../storage/index.ts";
import { atlasBaseDatabasePath } from "@uk-data-atlas/atlas-db";

import {
	readAreaLookup,
	readSqliteAreaInventory as readAreaInventory,
} from "@uk-data-atlas/areas";
import { readSqliteNamedLocationInventory as readNamedLocationInventory } from "@uk-data-atlas/places";
import { placeIndexTables } from "../storage/index.ts";
import { readBuildBoundaryRegistry } from "../geographies/buildBoundaryRegistry.ts";

export const buildDuckdbPlaceIndex = async (repositoryRoot: string) => {
	const databasePath = atlasBaseDatabasePath(repositoryRoot);
	const areaInventory = readAreaInventory(repositoryRoot, databasePath);
	const index = await compileDuckdbPlaceIndex(
		readAreaLookup(repositoryRoot, areaInventory, undefined, databasePath),
		readNamedLocationInventory(repositoryRoot, databasePath),
		areaInventory.contentHash,
		readBuildBoundaryRegistry(repositoryRoot),
	);
	const tables = placeIndexTables(index);
	const outputPath = writeCacheTables(repositoryRoot, "place-index", tables);

	return {
		outputPath,
		places: index.places.length,
		names: index.names.length,
	};
};
