import { readFile } from "fs/promises";
import { join } from "path";
import { PUBLIC_DATA, SOURCE_DATA } from "../paths.mts";

/**
 * Reads a file relative to data/. This is raw source data, which is not synced
 * to public/data: that only holds files served to the browser.
 */
export const readSource = (path: string) =>
	readFile(join(SOURCE_DATA, path), "utf8");

/**
 * Reads a compiled boundary asset. The compiler writes them to public/data,
 * where they are served from; the two releases published as TopoJSON rather
 * than GeoJSON are committed in data/ and copied across afterwards, so fall
 * back there for those.
 */
export const readBoundaryAsset = async (path: string) => {
	try {
		return await readFile(join(PUBLIC_DATA, path), "utf8");
	} catch {
		return readSource(path);
	}
};
