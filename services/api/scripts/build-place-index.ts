import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	readAreaInventory,
	readAreaLookup,
	readBoundaryRegistry,
} from "../src/boundaryLoader";
import { readNamedLocationInventory } from "../src/locationLoader";
import {
	compilePlaceIndex,
	PLACE_INDEX_DATABASE,
	writePlaceIndexDatabase,
} from "../src/placeIndex";
import { writeStoredText } from "../src/storedText";

export const buildPlaceIndex = (repositoryRoot: string) => {
	const apiRoot = join(repositoryRoot, "services", "api");
	const areaInventory = readAreaInventory(apiRoot);
	const index = compilePlaceIndex(
		readAreaLookup(apiRoot, areaInventory),
		readNamedLocationInventory(apiRoot),
		areaInventory.contentHash,
		readBoundaryRegistry(apiRoot),
	);
	const outputPath = join(apiRoot, "public", PLACE_INDEX_DATABASE);
	// The server searches the SQLite tables. The JSON is what the atlas
	// release pins, stored gzipped and never read by a request.
	writeStoredText(
		join(apiRoot, "public", "place-index.json"),
		`${JSON.stringify(index)}\n`,
	);
	writePlaceIndexDatabase(outputPath, index);
	return {
		outputPath,
		places: index.places.length,
		names: index.names.length,
	};
};

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const result = buildPlaceIndex(resolve(dirname(scriptPath), "../../.."));
	console.log(
		`Wrote ${result.places} places under ${result.names} names to ${result.outputPath}`,
	);
}
