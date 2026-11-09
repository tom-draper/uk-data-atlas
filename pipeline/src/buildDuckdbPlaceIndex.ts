import { compileDuckdbPlaceIndex } from "./places/duckdbPlaceIndex.ts";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { publishCacheTables, stampCacheStage } from "./storage/index.ts";

import {
	readAreaLookup,
	readSqliteAreaInventory as readAreaInventory,
} from "@uk-data-atlas/areas";
import { readSqliteNamedLocationInventory as readNamedLocationInventory } from "@uk-data-atlas/atlas-runtime/places";
import { readGeographyCatalogue } from "@uk-data-atlas/atlas-runtime/catalogue";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { placeIndexTables } from "./storage/index.ts";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";

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
	const outputPath = publishCacheTables(
		repositoryRoot,
		"place-index",
		tables,
	);
	stampCacheStage(repositoryRoot, {
		stage: "place-index",
		component: "place-index",
		tables: Object.keys(tables),
	});
	for (const filename of [
		"place-index.sqlite",
		"place-index.json",
		"place-index.json.gz",
	])
		rmSync(join(artifactDirectory(repositoryRoot), filename), {
			force: true,
		});

	return {
		outputPath,
		places: index.places.length,
		names: index.names.length,
	};
};
