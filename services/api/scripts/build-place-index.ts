import { copyFileSync, renameSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { writeSqliteTables } from "../src/sqliteIndex";
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
	const outputPath = join(repositoryRoot, "data/build/atlas.sqlite");
	const temporary = `${outputPath}.place-index.tmp`;
	try {
		copyFileSync(outputPath, temporary);
		const database = new DatabaseSync(temporary);
		try {
			database.exec("BEGIN");
			const tables = placeIndexTables(index);
			for (const name of Object.keys(tables))
				database.exec(`DROP TABLE IF EXISTS ${name}`);
			writeSqliteTables(database, tables);
			database.exec("COMMIT");
		} finally {
			database.close();
		}
		renameSync(temporary, outputPath);
	} finally {
		rmSync(temporary, { force: true });
	}
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
