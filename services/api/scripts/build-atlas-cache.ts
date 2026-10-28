import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAtlasCache } from "../src/cache-build/buildAtlasCache";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath)
	console.log(
		JSON.stringify(
			buildAtlasCache(resolve(dirname(scriptPath), "../../..")),
		),
	);
