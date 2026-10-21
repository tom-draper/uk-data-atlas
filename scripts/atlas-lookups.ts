import { join } from "node:path";
import { ATLAS_BOUNDARY_VINTAGES } from "@uk-data-atlas/catalogue";
import {
	ATLAS_LOOKUP_FILES,
	lsoaLadMappingsFile,
} from "@uk-data-atlas/geography";

/**
 * The containment and lineage lookups the API compiles for the atlas. The
 * browser fetches them from the API; the precompile reads a local copy,
 * fetched by `pnpm lookups:fetch`, so the chunks it cuts agree with them.
 */
export const ATLAS_LOOKUPS_CACHE = join(".cache", "atlas-lookups");

/** Every lookup file the atlas reads, by file name. */
export const ATLAS_LOOKUP_NAMES: readonly string[] = [
	...ATLAS_LOOKUP_FILES,
	...Object.keys(ATLAS_BOUNDARY_VINTAGES.lsoa).map((year) =>
		lsoaLadMappingsFile(Number(year)),
	),
].sort();

/** Where the precompile reads one lookup, such as `boundary-mappings.json`. */
export const atlasLookupPath = (root: string, name: string) =>
	join(root, ATLAS_LOOKUPS_CACHE, name);
