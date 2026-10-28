import { join } from "node:path";
import { rmSync } from "node:fs";
import {
	compileAreaSearchIndex,
	areaSearchIndexTables,
} from "../../../../shared/areaSearchCompiler";
import { readSqliteAreaInventory } from "../../../../shared/atlasAreaReader";
import { readAreaLookup } from "../../../../shared/areaLookup";
import { publishCacheTables } from "../../../../shared/atlasCache";
import { apiRootOf, artifactRoot } from "../../../../shared/dataLayout";

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
