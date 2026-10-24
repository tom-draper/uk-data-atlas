import { readAtlasAssetText } from "../shared/atlasSqlite";
import { ATLAS_BOUNDARY_VINTAGES } from "@uk-data-atlas/catalogue";
import {
	ATLAS_LOOKUP_FILES,
	lsoaLadMappingsFile,
} from "@uk-data-atlas/geography";

/** Every lookup file the atlas reads, by file name. */
export const ATLAS_LOOKUP_NAMES: readonly string[] = [
	...ATLAS_LOOKUP_FILES,
	...Object.keys(ATLAS_BOUNDARY_VINTAGES.lsoa).map((year) =>
		lsoaLadMappingsFile(Number(year)),
	),
].sort();

/** Read the same lookup payload served to the browser. */
export const readAtlasLookup = (root: string, name: string) =>
	readAtlasAssetText(root, "lookups", name.replace(/\.json$/, ""));
