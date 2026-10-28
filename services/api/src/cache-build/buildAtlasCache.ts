import { dirname, resolve } from "node:path";
import { buildAreaSearchIndex } from "./buildAreaSearchIndex";
import { buildPlaceIndex } from "./buildPlaceIndex";
import { buildPostcodeCounts } from "./buildPostcodeCounts";
import { readSqliteAreaInventory as readAreaInventory } from "../../../../shared/atlasAreaReader";
import { readAreaLookup } from "../../../../shared/areaLookup";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
} from "../../../../shared/crosswalkLoader";
import { readNamedLocationInventory } from "../../../../shared/locationLoader";
import {
	compileLocationProjections,
	locationProjectionTables,
} from "../../../../shared/locationProjections";
import { publishAtlasCache } from "../../../../shared/atlasCache";
import { writeSqliteTables } from "../../../../shared/sqliteIndex";
import { apiRootOf } from "../../../../shared/dataLayout";

/** Rebuild API accelerators using only the distributed canonical database. */
export function buildAtlasCache(root: string) {
	const apiRoot = apiRootOf(root);
	const started = performance.now();
	buildAreaSearchIndex(root);
	buildPlaceIndex(root);
	const areas = readAreaInventory(apiRoot);
	const crosswalks = readCrosswalkInventory(apiRoot);
	const namedLocations = readNamedLocationInventory(apiRoot);
	const memberGeographies = new Set(
		namedLocations.locations.map((location) => location.memberGeography),
	);
	const relevant = {
		...crosswalks,
		crosswalks: crosswalks.crosswalks.filter(
			(entry) =>
				memberGeographies.has(entry.from.geography) ||
				memberGeographies.has(entry.to.geography),
		),
	};
	const compiled = compileLocationProjections(
		namedLocations,
		relevant,
		readCrosswalkLookup(apiRoot, relevant).values(),
		readAreaLookup(apiRoot, areas),
	);
	publishAtlasCache(root, "projections", (database) => {
		const tables = locationProjectionTables(compiled);
		for (const name of Object.keys(tables))
			database.exec(`DROP TABLE IF EXISTS ${name}`);
		writeSqliteTables(database, tables);
		database
			.prepare("INSERT OR REPLACE INTO payloads VALUES (?, ?)")
			.run(
				"location-projection-inventory",
				JSON.stringify(compiled.inventory),
			);
	});
	buildPostcodeCounts(root);
	return { milliseconds: performance.now() - started };
}
