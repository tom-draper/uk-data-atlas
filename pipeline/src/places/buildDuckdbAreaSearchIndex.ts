import { areaSearchIndexTables } from "../storage/index.ts";
import { readAreaLookup, readSqliteAreaInventory } from "@uk-data-atlas/areas";
import { atlasBaseDatabasePath } from "@uk-data-atlas/atlas-db";

import { writeCacheTables } from "../storage/index.ts";
import { compileDuckdbAreaSearchIndex } from "./duckdbAreaSearch.ts";

export async function buildDuckdbAreaSearchIndex(root: string) {
	const databasePath = atlasBaseDatabasePath(root);
	const inventory = readSqliteAreaInventory(root, databasePath);
	const index = await compileDuckdbAreaSearchIndex(
		readAreaLookup(root, inventory, undefined, databasePath),
		inventory.contentHash,
	);
	const tables = areaSearchIndexTables(index);
	const outputPath = writeCacheTables(root, "area-search", tables);
	return {
		outputPath,
		areas: index.releases.reduce(
			(sum, release) => sum + release.codes.length,
			0,
		),
		terms: index.terms.length,
	};
}
