import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";
import {
	ATLAS_LOOKUP_NAMES,
	atlasAssetsDirectory,
} from "@uk-data-atlas/atlas-runtime/storage";
import type { AtlasAssetKind } from "@uk-data-atlas/atlas-runtime/storage";

/** Assemble release assets before the release manifest hashes the database. */
export function buildAtlasAssets(root: string) {
	const publicDirectory = atlasAssetsDirectory(root);
	const assets: {
		kind: AtlasAssetKind;
		id: string;
		sha256: string;
		gzip: Buffer;
	}[] = [];
	for (const [kind, required] of [
		[
			"lookups",
			ATLAS_LOOKUP_NAMES.map((name) => name.replace(/\.json$/, "")),
		],
		[
			"pages",
			["docs-catalogue", "place-facts", "places-index", "ward-areas"],
		],
	] satisfies [AtlasAssetKind, string[]][]) {
		const manifest: unknown = JSON.parse(
			readFileSync(join(publicDirectory, `atlas-${kind}.json`), "utf8"),
		);
		if (
			!manifest ||
			typeof manifest !== "object" ||
			!("schemaVersion" in manifest) ||
			manifest.schemaVersion !== 1 ||
			!(kind in manifest)
		)
			throw new Error(`Invalid atlas ${kind} manifest`);
		const entries: unknown = Reflect.get(manifest, kind);
		if (!Array.isArray(entries))
			throw new Error(`Invalid atlas ${kind} entries`);
		const ids = new Set<string>();
		for (const entry of entries) {
			if (
				!entry ||
				typeof entry !== "object" ||
				!("id" in entry) ||
				typeof entry.id !== "string" ||
				!/^[A-Za-z0-9-]+$/.test(entry.id) ||
				ids.has(entry.id) ||
				!("artifact" in entry) ||
				entry.artifact !== `atlas-${kind}/${entry.id}.json.gz` ||
				!("contentHash" in entry) ||
				typeof entry.contentHash !== "string" ||
				!("bytes" in entry) ||
				typeof entry.bytes !== "number" ||
				!("gzipBytes" in entry) ||
				typeof entry.gzipBytes !== "number"
			)
				throw new Error(`Invalid atlas ${kind} entry`);
			const gzip = readFileSync(join(publicDirectory, entry.artifact));
			const json = gunzipSync(gzip);
			const sha256 = createHash("sha256").update(json).digest("hex");
			if (
				`sha256:${sha256}` !== entry.contentHash ||
				json.length !== entry.bytes ||
				gzip.length !== entry.gzipBytes
			)
				throw new Error(
					`${entry.artifact} does not match its manifest`,
				);
			ids.add(entry.id);
			assets.push({ kind, id: entry.id, sha256, gzip });
		}
		for (const id of required)
			if (!ids.has(id))
				throw new Error(`Missing atlas ${kind} asset ${id}`);
	}
	const path = join(root, "data/build/atlas.sqlite");
	if (!existsSync(path))
		throw new Error("Missing atlas.sqlite. Run pnpm data:build first.");
	const database = new DatabaseSync(path);
	try {
		database.exec("BEGIN IMMEDIATE");
		database.exec(`CREATE TABLE IF NOT EXISTS website_assets (
			kind TEXT NOT NULL, id TEXT NOT NULL, sha256 TEXT NOT NULL,
			gzip BLOB NOT NULL, PRIMARY KEY (kind, id)
		) WITHOUT ROWID`);
		const current = database
			.prepare("SELECT kind, id, sha256 FROM website_assets")
			.all();
		const hashes = new Map(
			current.map((row) => [`${row.kind}:${row.id}`, row.sha256]),
		);
		if (
			current.length !== assets.length ||
			assets.some(
				(asset) =>
					hashes.get(`${asset.kind}:${asset.id}`) !== asset.sha256,
			)
		) {
			database.exec("DELETE FROM website_assets");
			const insert = database.prepare(
				"INSERT INTO website_assets VALUES (?, ?, ?, ?)",
			);
			for (const asset of assets)
				insert.run(asset.kind, asset.id, asset.sha256, asset.gzip);
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
	buildAtlasAssets(resolve(import.meta.dirname, "../.."));
	console.log("Website pages and lookups are stored in atlas.sqlite.");
}
