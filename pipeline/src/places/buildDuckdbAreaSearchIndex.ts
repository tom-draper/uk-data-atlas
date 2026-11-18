import { areaSearchIndexTables } from "../storage/index.ts";
import { readAreaLookup, readSqliteAreaInventory } from "@uk-data-atlas/areas";

import { writeCacheTables } from "../storage/index.ts";
import { compileDuckdbAreaSearchIndex } from "./duckdbAreaSearch.ts";

export async function buildDuckdbAreaSearchIndex(root: string) {
	const inventory = readSqliteAreaInventory(root);
	const index = await compileDuckdbAreaSearchIndex(
		readAreaLookup(root, inventory),
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
