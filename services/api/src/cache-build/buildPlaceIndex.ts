import { rmSync } from "node:fs";
import { join } from "node:path";
import { publishCacheTables } from "@uk-data-atlas/atlas-runtime/storage";
import { readSqliteAreaInventory as readAreaInventory } from "@uk-data-atlas/atlas-runtime/storage";
import { readAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import { readSqliteNamedLocationInventory as readNamedLocationInventory } from "@uk-data-atlas/atlas-runtime/storage";
import { readGeographyCatalogue } from "@uk-data-atlas/atlas-runtime/catalogue";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import {
	compilePlaceIndex,
	placeIndexTables,
} from "@uk-data-atlas/atlas-runtime/places";
import { apiRootOf, artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";

const readBoundaryRegistry = (apiRoot: string) =>
	readGeographyCatalogue<BoundaryRegistry>(
		apiRoot,
		"boundary-releases",
		"releases",
		"boundary registry",
	);

export const buildPlaceIndex = (repositoryRoot: string) => {
	const apiRoot = apiRootOf(repositoryRoot);
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
		rmSync(join(artifactRoot(apiRoot), filename), { force: true });

	return {
		outputPath,
		places: index.places.length,
		names: index.names.length,
	};
};
