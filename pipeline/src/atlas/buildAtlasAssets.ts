import { randomUUID } from "node:crypto";
import { sha256Hex } from "../lib/hash.ts";
import { readFileSync, renameSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync, gzipSync } from "node:zlib";
import {
	ATLAS_LOOKUP_NAMES,
	atlasAssetsDirectory,
	atlasDatabasePath,
	websiteAssetsPath,
} from "@uk-data-atlas/atlas-db";
import type { AtlasAssetKind } from "@uk-data-atlas/atlas-db";
import {
	AREA_LINEAGE_FILE,
	ATLAS_BOUNDARY_VINTAGES,
	type AreaLineage,
} from "@uk-data-atlas/geography";
import { readJsonSync } from "../lib/json.ts";
import { compileLineagesFromEvents } from "./areaLineageFromEvents.ts";

/** The lineage of the areas the atlas draws, read from the release's change events. */
export function readAreaLineages(root: string): Record<string, AreaLineage> {
	const database = new DatabaseSync(atlasDatabasePath(root), {
		readOnly: true,
	});
	try {
		return compileLineagesFromEvents(database, ATLAS_BOUNDARY_VINTAGES);
	} finally {
		database.close();
	}
}

const lineageId = AREA_LINEAGE_FILE.replace(/\.json$/, "");

/**
 * Validate the website's pages and lookups and write them to
 * `website-assets.sqlite`, with the lineage given as a lookup of its own. The
 * file is the final home of `website_asset`: it is not merged into
 * `atlas.sqlite`, which holds only what the API serves.
 */
export function buildAtlasAssets(
	root: string,
	lineage: Record<string, AreaLineage>,
) {
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
			ATLAS_LOOKUP_NAMES.filter((name) => name !== AREA_LINEAGE_FILE).map(
				(name) => name.replace(/\.json$/, ""),
			),
		],
		[
			"pages",
			["docs-catalogue", "place-facts", "places-index", "ward-areas"],
		],
	] satisfies [AtlasAssetKind, string[]][]) {
		const manifest: unknown = readJsonSync(
			join(publicDirectory, `atlas-${kind}.json`),
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
			const sha256 = sha256Hex(json);
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
	const lineageJson = Buffer.from(JSON.stringify(lineage));
	assets.push({
		kind: "lookups",
		id: lineageId,
		sha256: sha256Hex(lineageJson),
		gzip: gzipSync(lineageJson),
	});
	const path = websiteAssetsPath(root);
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		const database = new DatabaseSync(temporary);
		try {
			database.exec(`CREATE TABLE website_asset (
				kind TEXT NOT NULL, id TEXT NOT NULL, sha256 TEXT NOT NULL,
				gzip BLOB NOT NULL, PRIMARY KEY (kind, id)
			) STRICT, WITHOUT ROWID`);
			database.exec("BEGIN");
			const insert = database.prepare(
				"INSERT INTO website_asset VALUES (?, ?, ?, ?)",
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
