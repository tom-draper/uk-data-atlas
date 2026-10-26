import { join } from "node:path";
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

export const ATLAS_PAGES_DIRECTORY = "atlas-pages";
export const ATLAS_PAGES_MANIFEST = "atlas-pages.json";

export type AtlasPageManifest = {
	schemaVersion: 1;
	pages: Array<{
		id: string;
		artifact: string;
		/** The size of the JSON, once decompressed. */
		bytes: number;
		/** The size of the gzipped file stored. */
		gzipBytes: number;
		contentHash: string;
	}>;
};

export const ATLAS_LOOKUPS_DIRECTORY = "atlas-lookups";
export const ATLAS_LOOKUPS_MANIFEST = "atlas-lookups.json";

export type AtlasLookupManifest = {
	schemaVersion: 1;
	lookups: Array<{
		id: string;
		artifact: string;
		/** The size of the JSON, once decompressed. */
		bytes: number;
		/** The size of the gzipped file stored. */
		gzipBytes: number;
		contentHash: string;
	}>;
};

export const atlasAssetsDirectory = (root: string) =>
	join(root, "data/build/atlas-assets");
