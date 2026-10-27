import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAreaSearchIndex } from "../../../shared/buildAreaSearchIndex";
import { buildPlaceIndex } from "./build-place-index";
import { buildPostcodeCounts } from "./build-postcode-counts";
import { readAreaInventory, readAreaLookup } from "../src/boundaryLoader";
import {
	readCrosswalkInventory,
	readCrosswalkLookup,
} from "../src/crosswalkLoader";
import { readNamedLocationInventory } from "../src/locationLoader";
import {
	compileLocationProjections,
	locationProjectionTables,
} from "../src/locationProjections";
import { publishAtlasCache } from "../src/atlasCache";
import { writeSqliteTables } from "../src/sqliteIndex";

/** Rebuild API accelerators using only the distributed canonical database. */
export function buildAtlasCache(root: string) {
	const apiRoot = resolve(root, "services/api");
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

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath)
	console.log(
		JSON.stringify(
			buildAtlasCache(resolve(dirname(scriptPath), "../../..")),
		),
	);
