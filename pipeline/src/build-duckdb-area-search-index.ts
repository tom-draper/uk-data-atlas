import { rmSync } from "node:fs";
import { join } from "node:path";
import { areaSearchIndexTables } from "@uk-data-atlas/atlas-runtime/areas";
import { readAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import { readSqliteAreaInventory } from "@uk-data-atlas/atlas-runtime/storage";
import { publishCacheTables } from "@uk-data-atlas/atlas-runtime/storage";
import { apiRootOf, artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";
import { compileDuckdbAreaSearchIndex } from "./duckdbAreaSearch";

export async function buildDuckdbAreaSearchIndex(root: string) {
	const apiRoot = apiRootOf(root);
	const inventory = readSqliteAreaInventory(apiRoot);
	const index = await compileDuckdbAreaSearchIndex(
		readAreaLookup(apiRoot, inventory),
		inventory.contentHash,
	);
	const outputPath = publishCacheTables(
		root,
		"area-search",
		areaSearchIndexTables(index),
	);
	for (const name of [
		"area-search-index.sqlite",
		"area-search-index.json",
		"area-search-index.json.gz",
	])
		rmSync(join(artifactRoot(apiRoot), name), { force: true });
	return {
		outputPath,
		areas: index.releases.reduce(
			(sum, release) => sum + release.codes.length,
			0,
		),
		terms: index.terms.length,
	};
}
