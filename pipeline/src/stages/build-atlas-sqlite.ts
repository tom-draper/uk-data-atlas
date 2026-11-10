import { isMainModule } from "../lib/entrypoint.ts";
import { buildLog, repoPath } from "@uk-data-atlas/atlas-db";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAtlasSqlite } from "../atlas/buildAtlasSqlite.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url)) {
	const path = buildAtlasSqlite(resolve(dirname(scriptPath), "../../.."));
	buildLog.info(`Wrote shared atlas database to ${repoPath(path)}`);
}
