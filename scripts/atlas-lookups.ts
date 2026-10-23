import { join } from "node:path";
import { ATLAS_BOUNDARY_VINTAGES } from "@uk-data-atlas/catalogue";
import {
	ATLAS_LOOKUP_FILES,
	lsoaLadMappingsFile,
} from "@uk-data-atlas/geography";

/**
 * The containment and lineage lookups the API build compiles for the atlas.
 * `pnpm data:build --only website-lookups` copies them from the API's output on disk into
 * public/data/atlas-lookups. The browser fetches them from there, and the
 * precompile reads the same files, so the chunks it cuts agree with them.
 */
export const ATLAS_LOOKUPS_DIRECTORY = join("public", "data", "atlas-lookups");

/** Every lookup file the atlas reads, by file name. */
export const ATLAS_LOOKUP_NAMES: readonly string[] = [
	...ATLAS_LOOKUP_FILES,
	...Object.keys(ATLAS_BOUNDARY_VINTAGES.lsoa).map((year) =>
		lsoaLadMappingsFile(Number(year)),
	),
].sort();

/** Where the precompile reads one lookup, such as `boundary-mappings.json`. */
export const atlasLookupPath = (root: string, name: string) =>
	join(root, ATLAS_LOOKUPS_DIRECTORY, name);
