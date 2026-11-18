import { compileDuckdbPlaceIndex } from "./duckdbPlaceIndex.ts";
import { writeCacheTables } from "../storage/index.ts";

import {
	readAreaLookup,
	readSqliteAreaInventory as readAreaInventory,
} from "@uk-data-atlas/areas";
import { readSqliteNamedLocationInventory as readNamedLocationInventory } from "@uk-data-atlas/places";
import { readGeographyCatalogue } from "@uk-data-atlas/catalogue/node";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { placeIndexTables } from "../storage/index.ts";

const readBoundaryRegistry = (repositoryRoot: string) =>
	readGeographyCatalogue<BoundaryRegistry>(
		repositoryRoot,
		"boundary-releases",
		"releases",
		"boundary registry",
	);

export const buildDuckdbPlaceIndex = async (repositoryRoot: string) => {
	const areaInventory = readAreaInventory(repositoryRoot);
	const index = await compileDuckdbPlaceIndex(
		readAreaLookup(repositoryRoot, areaInventory),
		readNamedLocationInventory(repositoryRoot),
		areaInventory.contentHash,
		readBoundaryRegistry(repositoryRoot),
	);
	const tables = placeIndexTables(index);
	const outputPath = writeCacheTables(repositoryRoot, "place-index", tables);

	return {
		outputPath,
		places: index.places.length,
		names: index.names.length,
	};
};
