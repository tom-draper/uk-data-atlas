import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	AREA_SEARCH_INDEX_DATABASE,
	compileAreaSearchIndex,
	writeAreaSearchIndexDatabase,
} from "../src/areaSearch";
import { readAreaInventory, readAreaLookup } from "../src/boundaryLoader";
import { writeStoredText } from "../src/storedText";

export const buildAreaSearchIndex = (repositoryRoot: string) => {
	const apiRoot = join(repositoryRoot, "services", "api");
	const areaInventory = readAreaInventory(apiRoot);
	const index = compileAreaSearchIndex(
		readAreaLookup(apiRoot, areaInventory),
		areaInventory.contentHash,
	);
	const outputPath = join(apiRoot, "public", AREA_SEARCH_INDEX_DATABASE);
	// The server searches the SQLite tables. The JSON is what the atlas
	// release pins, stored gzipped and never read by a request.
	writeStoredText(
		join(apiRoot, "public", "area-search-index.json"),
		`${JSON.stringify(index)}\n`,
	);
	writeAreaSearchIndexDatabase(outputPath, index);
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
