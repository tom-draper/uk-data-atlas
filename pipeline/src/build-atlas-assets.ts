import { createHash, randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";
import {
	ATLAS_LOOKUP_NAMES,
	atlasAssetsDirectory,
	buildLog,
} from "@uk-data-atlas/atlas-runtime/storage";
import type { AtlasAssetKind } from "@uk-data-atlas/atlas-runtime/storage";

/** Validate and stage release assets before assembling the database. */
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
	const path = join(root, "data/build/website-assets.sqlite");
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		const database = new DatabaseSync(temporary);
		try {
			database.exec(`CREATE TABLE website_assets (
				kind TEXT NOT NULL, id TEXT NOT NULL, sha256 TEXT NOT NULL,
				gzip BLOB NOT NULL, PRIMARY KEY (kind, id)
			) WITHOUT ROWID`);
			database.exec("BEGIN");
			const insert = database.prepare(
				"INSERT INTO website_assets VALUES (?, ?, ?, ?)",
			);
			for (const asset of assets)
				insert.run(asset.kind, asset.id, asset.sha256, asset.gzip);
			database.exec("COMMIT");
		} finally {
			database.close();
		}
		renameSync(temporary, path);
	} finally {
		rmSync(temporary, { force: true });
	}
	return path;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === resolve(import.meta.filename)
) {
	buildAtlasAssets(resolve(import.meta.dirname, "../.."));
	buildLog.info(
		"Staged website pages and lookups in data/build/website-assets.sqlite",
	);
}
