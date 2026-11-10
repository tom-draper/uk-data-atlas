import { isMainModule } from "./lib/entrypoint.ts";
import { resolve } from "node:path";
import { buildLog } from "@uk-data-atlas/atlas-db";
import {
	checkStagedComponents,
	stampAtlasCache,
} from "./storage/stampAtlasCache.ts";

if (isMainModule(import.meta.url)) {
	const root = resolve(import.meta.dirname, "../..");
	checkStagedComponents(root);
	buildLog.info(
		`Stamped the atlas cache with content hash ${stampAtlasCache(root)}`,
	);
}
