import { createHash } from "node:crypto";
import { closeSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { openReadOnlyDatabase } from "@uk-data-atlas/atlas-runtime/storage";

export function validateCacheRelease(root: string): void {
	const canonical = join(root, "data/build/atlas.sqlite");
	const cachePath = join(root, "data/build/atlas-cache.sqlite");
	try {
		const cache = openReadOnlyDatabase(cachePath, { fresh: true });
		let stamped: unknown;
		try {
			stamped = cache
				.prepare("SELECT value FROM meta WHERE key = ?")
				.get("atlas-sqlite-content-hash")?.value;
		} finally {
			cache.release();
		}
		const hash = createHash("sha256");
		const buffer = Buffer.allocUnsafe(1024 * 1024);
		const file = openSync(canonical, "r");
		try {
			for (
				let bytes;
				(bytes = readSync(file, buffer, 0, buffer.length, null));
			)
				hash.update(buffer.subarray(0, bytes));
		} finally {
			closeSync(file);
		}
		const actual = `sha256:${hash.digest("hex")}`;
		if (stamped !== actual)
			throw new Error(
				`release mismatch: cache references ${String(stamped)}, atlas.sqlite is ${actual}`,
			);
		const canonicalDatabase = openReadOnlyDatabase(canonical, {
			fresh: true,
		});
		const cacheDatabase = openReadOnlyDatabase(cachePath, { fresh: true });
		try {
			const payload = cacheDatabase.prepare(
				"SELECT 1 FROM dataset_payloads WHERE output = ? AND source_sha256 = ? AND gzip IS NOT NULL",
			);
			for (const dataset of canonicalDatabase
				.prepare(
					"SELECT output, sha256 FROM datasets WHERE payloadId IS NULL",
				)
				.all()) {
				if (!payload.get(dataset.output, dataset.sha256))
					throw new Error(
						`Missing cached dataset payload ${String(dataset.output)} for this release`,
					);
			}
		} finally {
			cacheDatabase.release();
			canonicalDatabase.release();
		}
	} catch (cause) {
		throw new Error(
			`Missing or mismatched atlas cache release at ${cachePath}`,
			{ cause },
		);
	}
}
