import { isMainModule } from "../lib/entrypoint.ts";
import { resolve } from "node:path";
import { buildLog } from "@uk-data-atlas/atlas-db";
import { assembleAtlasCache } from "../storage/atlasCacheWriter.ts";

if (isMainModule(import.meta.url)) {
	const root = resolve(import.meta.dirname, "../../..");
	buildLog.info(
		`Assembled the atlas cache for content hash ${assembleAtlasCache(root)}`,
	);
}
