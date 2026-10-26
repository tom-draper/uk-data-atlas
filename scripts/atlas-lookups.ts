import { readAtlasAssetText } from "../shared/atlasSqlite";
export { ATLAS_LOOKUP_NAMES } from "../shared/atlasAssets";

/** Read the same lookup payload served to the browser. */
export const readAtlasLookup = (root: string, name: string) =>
	readAtlasAssetText(root, "lookups", name.replace(/\.json$/, ""));
