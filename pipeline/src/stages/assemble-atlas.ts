import { isMainModule } from "../lib/entrypoint.ts";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleAtlas } from "../atlas/assembleAtlas.ts";

const scriptPath = fileURLToPath(import.meta.url);
if (isMainModule(import.meta.url))
	console.log(
		`Assembled atlas components into ${assembleAtlas(resolve(dirname(scriptPath), "../../.."))}`,
	);
