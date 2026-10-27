export { buildAtlasCache } from "../../../shared/buildAtlasCache";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildAtlasCache } from "../../../shared/buildAtlasCache";

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath)
	console.log(
		JSON.stringify(
			buildAtlasCache(resolve(dirname(scriptPath), "../../..")),
		),
	);
