import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileAreaSearchIndex } from "../src/areaSearch";
import { readAreaInventory, readAreaLookup } from "../src/boundaryLoader";

export const buildAreaSearchIndex = (repositoryRoot: string) => {
	const apiRoot = join(repositoryRoot, "api");
	const areaInventory = readAreaInventory(apiRoot);
	const index = compileAreaSearchIndex(
		readAreaLookup(apiRoot, areaInventory),
		areaInventory.contentHash,
	);
	const outputPath = join(apiRoot, "public", "area-search-index.json");
	// Compact: this is an index read by machine, and indenting it would
	// double its size.
	writeFileSync(outputPath, `${JSON.stringify(index)}\n`);
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
	const result = buildAreaSearchIndex(resolve(dirname(scriptPath), "../.."));
	console.log(
		`Wrote ${result.areas} area identities under ${result.terms} terms to ${result.outputPath}`,
	);
}
