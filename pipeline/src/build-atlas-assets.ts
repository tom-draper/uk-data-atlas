import { isMainModule } from "./lib/entrypoint.ts";
import { buildLog } from "@uk-data-atlas/atlas-db";
import { resolve } from "node:path";
import { buildAtlasAssets } from "./atlas/buildAtlasAssets.ts";

if (isMainModule(import.meta.url)) {
	buildAtlasAssets(resolve(import.meta.dirname, "../.."));
	buildLog.info(
		"Wrote website pages and lookups to data/build/website-assets.sqlite",
	);
}
