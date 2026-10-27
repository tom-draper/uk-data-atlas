import { readFile } from "fs/promises";
import { join } from "path";
import { BOUNDARY_DATA, SOURCE_DATA } from "../paths.mts";

/**
 * Reads a file relative to data/. This is raw source data, which is not synced
 * to public/data: that only holds files served to the browser.
 */
export const readSource = (path: string) =>
	readFile(join(SOURCE_DATA, path), "utf8");

/** Reads a private compiled boundary, falling back to an original source. */
export const readBoundaryAsset = async (path: string) => {
	path = path.replace(/\.pmtiles$/, ".topojson");
	try {
		return await readFile(join(BOUNDARY_DATA, path), "utf8");
	} catch {
		return readSource(path);
	}
};
