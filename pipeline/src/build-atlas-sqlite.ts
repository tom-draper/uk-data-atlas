import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAtlasSqlite } from "../../shared/buildAtlasSqlite";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const path = buildAtlasSqlite(resolve(dirname(scriptPath), "../.."));
	console.log(`Wrote shared atlas database to ${path}`);
}
