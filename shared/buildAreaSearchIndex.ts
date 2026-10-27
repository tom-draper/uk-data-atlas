import { join } from "node:path";
import { rmSync } from "node:fs";
import {
	compileAreaSearchIndex,
	areaSearchIndexTables,
} from "./areaSearchCompiler";
import { readSqliteAreaInventory } from "./atlasAreaReader";
import { readAreaLookup } from "./areaLookup";
import { publishCacheTables } from "./atlasCache";

export const buildAreaSearchIndex = (repositoryRoot: string) => {
	const apiRoot = join(repositoryRoot, "services", "api");
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
		rmSync(join(apiRoot, "public", filename), { force: true });

	return {
		outputPath,
		areas: index.releases.reduce(
			(total, release) => total + release.codes.length,
			0,
		),
		terms: index.terms.length,
	};
};
