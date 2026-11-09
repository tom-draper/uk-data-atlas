import { gunzipSync } from "node:zlib";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { websiteAssetsPath } from "./dataLayout.ts";
import { openReadOnlyDatabase } from "./readOnlyDatabase.ts";
import { unpackText } from "./storedPayload.ts";

/** A payload stored in the shared compiled release, or undefined when it holds none. Connections are shared and reopen when the file is replaced. */
export function readStoredAtlasPayload(
	repositoryRoot: string,
	id: string,
	path = join(repositoryRoot, "data/build/atlas.sqlite"),
): string | undefined {
	const database = openReadOnlyDatabase(path);
	try {
		return unpackText(
			database
				.prepare("SELECT payload FROM payloads WHERE id = ?")
				.get(id)?.payload,
		);
	} finally {
		database.release();
	}
}

/** A payload stored in the shared compiled release. */
export function requireAtlasPayload(
	repositoryRoot: string,
	id: string,
	path = join(repositoryRoot, "data/build/atlas.sqlite"),
): string {
	const stored = readStoredAtlasPayload(repositoryRoot, id, path);
	if (stored !== undefined) return stored;
	throw new Error(`Missing payload ${id} at ${path}`);
}

export type AtlasAssetKind = "pages" | "lookups";

/**
 * Read precompressed website data from `website-assets.sqlite`, a file of its
 * own so the shared release carries only what the API serves.
 */
export function readAtlasAsset(root: string, kind: AtlasAssetKind, id: string) {
	const path = websiteAssetsPath(root);
	if (!existsSync(path))
		throw new Error(
			`Missing website assets database at ${path}. Run pnpm data:build --only website-lookups.`,
		);
	const database = openReadOnlyDatabase(path);
	try {
		const row = database
			.prepare(
				"SELECT sha256, gzip FROM website_asset WHERE kind = ? AND id = ?",
			)
			.get(kind, id);
		if (!row) return undefined;
		if (typeof row.sha256 !== "string" || !(row.gzip instanceof Uint8Array))
			throw new Error(`Invalid atlas ${kind} asset ${id}`);
		return { sha256: row.sha256, gzip: row.gzip };
	} finally {
		database.release();
	}
}

export function readAtlasAssetText(
	root: string,
	kind: AtlasAssetKind,
	id: string,
): string {
	if (!/^[A-Za-z0-9-]+$/.test(id))
		throw new Error(`Invalid atlas asset id ${id}`);
	const asset = readAtlasAsset(root, kind, id);
	if (!asset)
		throw new Error(
			`Missing atlas ${kind} asset ${id}. Run pnpm data:build --only website-lookups.`,
		);
	return gunzipSync(asset.gzip).toString("utf8");
}
