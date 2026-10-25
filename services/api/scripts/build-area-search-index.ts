import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	compileAreaSearchIndex,
	areaSearchIndexTables,
} from "../src/areaSearch";
import { readAreaInventory, readAreaLookup } from "../src/boundaryLoader";
import { rmSync } from "node:fs";
import { publishCacheTables } from "../src/atlasCache";

export const buildAreaSearchIndex = (repositoryRoot: string) => {
	const apiRoot = join(repositoryRoot, "services", "api");
	const areaInventory = readAreaInventory(apiRoot);
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

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildAreaSearchIndex(
		resolve(dirname(scriptPath), "../../.."),
	);
	console.log(
		`Wrote ${result.areas} area identities under ${result.terms} terms to ${result.outputPath}`,
	);
}
