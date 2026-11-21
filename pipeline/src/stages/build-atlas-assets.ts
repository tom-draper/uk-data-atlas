import { isMainModule } from "../lib/entrypoint.ts";
import { buildLog } from "@uk-data-atlas/atlas-db";
import { resolve } from "node:path";
import {
	buildAtlasAssets,
	readAreaLineages,
} from "../atlas/buildAtlasAssets.ts";

if (isMainModule(import.meta.url)) {
	const root = resolve(import.meta.dirname, "../../..");
	buildAtlasAssets(root, readAreaLineages(root));
	buildLog.info(
		"Wrote website pages and lookups to data/build/website-assets.sqlite",
	);
}
