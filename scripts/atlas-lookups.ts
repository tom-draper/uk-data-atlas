import { readAtlasAssetText } from "@uk-data-atlas/atlas-db";
export { ATLAS_LOOKUP_NAMES } from "@uk-data-atlas/atlas-db";

/** Read the same lookup payload served to the browser. */
export const readAtlasLookup = (root: string, name: string) =>
	readAtlasAssetText(root, "lookups", name.replace(/\.json$/, ""));
