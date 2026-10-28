import { compileDuckdbPlaceIndex } from "./duckdbPlaceIndex";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { publishCacheTables } from "../../shared/atlasCache";
import { readSqliteAreaInventory as readAreaInventory } from "../../shared/atlasAreaReader";
import { readAreaLookup } from "../../shared/areaLookup";
import { readSqliteNamedLocationInventory as readNamedLocationInventory } from "../../shared/atlasNamedLocationReader";
import { readGeographyCatalogue } from "../../shared/geographyCatalogue";
import type { BoundaryRegistry } from "../../shared/boundaryRegistry";
import { placeIndexTables } from "../../shared/placeIndex";
import { apiRootOf, artifactRoot } from "../../shared/dataLayout";

const readBoundaryRegistry = (apiRoot: string) =>
	readGeographyCatalogue<BoundaryRegistry>(
		apiRoot,
		"boundary-releases",
		"releases",
		"boundary registry",
	);

export const buildDuckdbPlaceIndex = async (repositoryRoot: string) => {
	const apiRoot = apiRootOf(repositoryRoot);
	const areaInventory = readAreaInventory(apiRoot);
	const index = await compileDuckdbPlaceIndex(
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
		rmSync(join(artifactRoot(apiRoot), filename), { force: true });

	return {
		outputPath,
		places: index.places.length,
		names: index.names.length,
	};
};
