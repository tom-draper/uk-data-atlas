import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function assembleWebsiteAssets(root: string) {
	const path = join(root, "data/build/atlas.sqlite");
	if (!existsSync(path))
		throw new Error("Missing atlas.sqlite. Run pnpm data:build first.");
	const database = new DatabaseSync(path);
	try {
		database
			.prepare("ATTACH DATABASE ? AS component")
			.run(join(root, "data/build/website-assets.sqlite"));
		database.exec("BEGIN IMMEDIATE");
		database.exec(`CREATE TABLE IF NOT EXISTS website_assets (
			kind TEXT NOT NULL, id TEXT NOT NULL, sha256 TEXT NOT NULL,
			gzip BLOB NOT NULL, PRIMARY KEY (kind, id)
		) WITHOUT ROWID`);
		const changed = database
			.prepare(
				`SELECT EXISTS (
			SELECT kind, id, sha256 FROM main.website_assets EXCEPT SELECT kind, id, sha256 FROM component.website_assets
		) OR EXISTS (
			SELECT kind, id, sha256 FROM component.website_assets EXCEPT SELECT kind, id, sha256 FROM main.website_assets
		) AS changed`,
			)
			.get();
		if (changed?.changed) {
			database.exec(
				"DELETE FROM main.website_assets; INSERT INTO main.website_assets SELECT * FROM component.website_assets",
			);
		}
		database.exec("COMMIT");
	} finally {
		database.close();
	}
	for (const directory of ["atlas-lookups", "atlas-pages", "precompiled"])
		rmSync(join(root, "public/data", directory), {
			recursive: true,
			force: true,
		});
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === resolve(import.meta.filename)
) {
	assembleWebsiteAssets(resolve(import.meta.dirname, "../.."));
	console.log("Website pages and lookups assembled into atlas.sqlite.");
}
