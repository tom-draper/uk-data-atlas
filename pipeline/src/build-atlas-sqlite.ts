import { buildLog, repoPath } from "@uk-data-atlas/atlas-runtime/storage";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAtlasSqlite } from "./atlas/buildAtlasSqlite.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const path = buildAtlasSqlite(resolve(dirname(scriptPath), "../.."));
	buildLog.info(`Wrote shared atlas database to ${repoPath(path)}`);
}
