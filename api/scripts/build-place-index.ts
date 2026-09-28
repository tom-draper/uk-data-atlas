import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readAreaInventory, readAreaLookup } from "../src/boundaryLoader";
import { readNamedLocationInventory } from "../src/locationLoader";
import { compilePlaceIndex } from "../src/placeIndex";

export const buildPlaceIndex = (repositoryRoot: string) => {
	const apiRoot = join(repositoryRoot, "api");
	const areaInventory = readAreaInventory(apiRoot);
	const index = compilePlaceIndex(
		readAreaLookup(apiRoot, areaInventory),
		readNamedLocationInventory(apiRoot),
		areaInventory.contentHash,
	);
	const outputPath = join(apiRoot, "public", "place-index.json");
	// Compact: this is an index read by machine, and indenting it would
	// double its size.
	writeFileSync(outputPath, `${JSON.stringify(index)}\n`);
	return {
		outputPath,
		places: index.places.length,
		names: index.names.length,
	};
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildPlaceIndex(resolve(dirname(scriptPath), "../.."));
	console.log(
		`Wrote ${result.places} places under ${result.names} names to ${result.outputPath}`,
	);
}
