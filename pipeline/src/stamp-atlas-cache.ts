import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { atlasCachePath } from "@uk-data-atlas/atlas-runtime/storage";
import { hashFile } from "./fileHashCache";

export function stampAtlasCache(root: string) {
	const canonical = resolve(root, "data/build/atlas.sqlite");
	const hash = hashFile(canonical);
	const cache = new DatabaseSync(atlasCachePath(root), { readOnly: false });
	try {
		cache
			.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)")
			.run("atlas-sqlite-content-hash", hash);
	} finally {
		cache.close();
	}
	if (hashFile(canonical) !== hash)
		throw new Error("atlas.sqlite changed while stamping its cache");
	return hash;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === resolve(import.meta.filename)
) {
	console.log(
		`Stamped cache for ${stampAtlasCache(resolve(import.meta.dirname, "../.."))}`,
	);
}
