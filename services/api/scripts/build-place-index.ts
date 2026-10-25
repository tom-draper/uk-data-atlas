import { rmSync } from "node:fs";
import { publishCacheTables } from "../src/atlasCache";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	readAreaInventory,
	readAreaLookup,
	readBoundaryRegistry,
} from "../src/boundaryLoader";
import { readNamedLocationInventory } from "../src/locationLoader";
import { compilePlaceIndex, placeIndexTables } from "../src/placeIndex";

export const buildPlaceIndex = (repositoryRoot: string) => {
	const apiRoot = join(repositoryRoot, "services", "api");
	const areaInventory = readAreaInventory(apiRoot);
	const index = compilePlaceIndex(
		readAreaLookup(apiRoot, areaInventory),
		readNamedLocationInventory(apiRoot),
		areaInventory.contentHash,
		readBoundaryRegistry(apiRoot),
	);
	const outputPath = publishCacheTables(
		repositoryRoot,
		"place-index",
		placeIndexTables(index),
	);
	for (const filename of [
		"place-index.sqlite",
		"place-index.json",
		"place-index.json.gz",
	])
		rmSync(join(apiRoot, "public", filename), { force: true });

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
