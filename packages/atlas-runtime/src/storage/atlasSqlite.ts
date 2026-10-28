import { readDatasetPayload } from "../catalogue/datasetPayloads";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Server-only access to the shared compiled release. Connections close before atomic replacements. */
export function readAtlasPayload(repositoryRoot: string, id: string): string {
	const path = join(repositoryRoot, "data/build/atlas.sqlite");
	const database = new DatabaseSync(path, { readOnly: true });
	let stored: unknown;
	try {
		stored = database
			.prepare("SELECT payload FROM payloads WHERE id = ?")
			.get(id)?.payload;
	} finally {
		database.close();
	}
	if (typeof stored === "string") return stored;
	// Datasets served from rows have no stored payload.
	if (id.startsWith("dataset:")) {
		const payload = readDatasetPayload(repositoryRoot, id.slice(8));
		if (payload !== undefined) return payload;
	}
	throw new Error(`Missing payload ${id} at ${path}`);
}

export function readAtlasDatasetUrls(
	repositoryRoot: string,
): Record<string, string> {
	const database = new DatabaseSync(
		join(repositoryRoot, "data/build/atlas.sqlite"),
		{ readOnly: true },
	);
	try {
		return Object.fromEntries(
			database
				.prepare("SELECT output, sha256 FROM datasets")
				.all()
				.map((row) => [
					String(row.output),
					`/data/catalogue/${row.sha256}/${row.output}.json`,
				]),
		);
	} finally {
		database.close();
	}
}

export function readVersionedAtlasDataset(
	repositoryRoot: string,
	output: string,
	sha256: string,
): string | undefined {
	return readDatasetPayload(repositoryRoot, output, sha256);
}

export type AtlasAssetKind = "pages" | "lookups";

/** Read precompressed website data without keeping a database connection open. */
export function readAtlasAsset(root: string, kind: AtlasAssetKind, id: string) {
	const database = new DatabaseSync(join(root, "data/build/atlas.sqlite"), {
		readOnly: true,
	});
	try {
		const row = database
			.prepare(
				"SELECT sha256, gzip FROM website_assets WHERE kind = ? AND id = ?",
			)
			.get(kind, id);
		if (!row) return undefined;
		if (typeof row.sha256 !== "string" || !(row.gzip instanceof Uint8Array))
			throw new Error(`Invalid atlas ${kind} asset ${id}`);
		return { sha256: row.sha256, gzip: row.gzip };
	} finally {
		database.close();
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
