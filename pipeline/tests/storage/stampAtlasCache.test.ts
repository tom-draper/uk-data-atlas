import assert from "node:assert/strict";
import {
	mkdtempSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import { stampAtlasCache } from "../../src/storage/stampAtlasCache";
import { stageStampPath } from "../../src/storage";

test("stamps the cache with the canonical database content hash", () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-stamp-"));
	try {
		const directory = join(root, "data/build");
		mkdirSync(directory, { recursive: true });
		writeFileSync(join(directory, "atlas.sqlite"), "canonical");
		const cache = new DatabaseSync(join(directory, "atlas-cache.sqlite"));
		cache.exec(
			"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
		);
		cache.close();
		const hash = stampAtlasCache(root);
		const stamped = new DatabaseSync(
			join(directory, "atlas-cache.sqlite"),
			{ readOnly: true },
		);
		try {
			assert.equal(
				stamped
					.prepare("SELECT value FROM meta WHERE key = ?")
					.get("atlas-sqlite-content-hash")?.value,
				hash,
			);
			assert.equal(
				hash,
				"sha256:0deeb8fa1dbbee4c0dbe7f5e3c9183940139f26d22797ee8ab07c00557a4c2ff",
			);
			// The stage's stamp holds the same hash for the data build to track.
			assert.deepEqual(
				JSON.parse(
					readFileSync(
						stageStampPath(root, "atlas-cache-stamp"),
						"utf8",
					),
				),
				{ "atlas-sqlite-content-hash": hash },
			);
		} finally {
			stamped.close();
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
