import { readAtlasAssetText } from "@uk-data-atlas/atlas-runtime/storage";
export { ATLAS_LOOKUP_NAMES } from "@uk-data-atlas/atlas-runtime/storage";

/** Read a lookup compiled for the shared atlas release. */
export const readAtlasLookup = (root: string, name: string) =>
	readAtlasAssetText(root, "lookups", name.replace(/\.json$/, ""));
