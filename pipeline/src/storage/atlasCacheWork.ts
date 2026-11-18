import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * `atlas-cache-stamp` copies the published cache to this file, adds the
 * components that stages left in their own parts, and renames it into place.
 * No other stage writes it.
 */
export const ATLAS_CACHE_WORK = "data/build/.atlas-cache.sqlite.work";

export const atlasCacheWorkPath = (root: string) =>
	join(root, ATLAS_CACHE_WORK);

/**
 * Throws away a working copy left by a build that did not finish. Returns
 * whether there was one.
 */
export function discardAtlasCacheWork(root: string) {
	const path = atlasCacheWorkPath(root);
	if (!existsSync(path)) return false;
	rmSync(path, { force: true });
	return true;
}
