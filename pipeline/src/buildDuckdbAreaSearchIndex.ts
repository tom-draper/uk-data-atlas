import { rmSync } from "node:fs";
import { join } from "node:path";
import { areaSearchIndexTables } from "./storage/index.ts";
import { readAreaLookup, readSqliteAreaInventory } from "@uk-data-atlas/areas";

import { publishCacheTables, stampCacheStage } from "./storage/index.ts";
import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { compileDuckdbAreaSearchIndex } from "./places/duckdbAreaSearch.ts";

export async function buildDuckdbAreaSearchIndex(root: string) {
	const inventory = readSqliteAreaInventory(root);
	const index = await compileDuckdbAreaSearchIndex(
		readAreaLookup(root, inventory),
		inventory.contentHash,
	);
	const tables = areaSearchIndexTables(index);
	const outputPath = publishCacheTables(root, "area-search", tables);
	stampCacheStage(root, {
		stage: "area-search-index",
		component: "area-search",
		tables: Object.keys(tables),
	});
	for (const name of [
		"area-search-index.sqlite",
		"area-search-index.json",
		"area-search-index.json.gz",
	])
		rmSync(join(artifactDirectory(root), name), { force: true });
	return {
		outputPath,
		areas: index.releases.reduce(
			(sum, release) => sum + release.codes.length,
			0,
		),
		terms: index.terms.length,
	};
}
