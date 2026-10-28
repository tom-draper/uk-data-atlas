import { join } from "node:path";
import { rmSync } from "node:fs";
import {
	compileAreaSearchIndex,
	areaSearchIndexTables,
} from "@uk-data-atlas/atlas-runtime/areas";
import { readSqliteAreaInventory } from "@uk-data-atlas/atlas-runtime/storage";
import { readAreaLookup } from "@uk-data-atlas/atlas-runtime/areas";
import { publishCacheTables } from "@uk-data-atlas/atlas-runtime/storage";
import { apiRootOf, artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";

export const buildAreaSearchIndex = (repositoryRoot: string) => {
	const apiRoot = apiRootOf(repositoryRoot);
	const areaInventory = readSqliteAreaInventory(apiRoot);
	const index = compileAreaSearchIndex(
		readAreaLookup(apiRoot, areaInventory),
		areaInventory.contentHash,
	);
	const outputPath = publishCacheTables(
		repositoryRoot,
		"area-search",
		areaSearchIndexTables(index),
	);
	for (const filename of [
		"area-search-index.sqlite",
		"area-search-index.json",
		"area-search-index.json.gz",
	])
		rmSync(join(artifactRoot(apiRoot), filename), { force: true });

	return {
		outputPath,
		areas: index.releases.reduce(
			(total, release) => total + release.codes.length,
			0,
		),
		terms: index.terms.length,
	};
};
