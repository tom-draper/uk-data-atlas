import { readAtlasAssetText } from "@uk-data-atlas/atlas-runtime/storage";
export { ATLAS_LOOKUP_NAMES } from "@uk-data-atlas/atlas-runtime/storage";

/** Read the same lookup payload served to the browser. */
export const readAtlasLookup = (root: string, name: string) =>
	readAtlasAssetText(root, "lookups", name.replace(/\.json$/, ""));
