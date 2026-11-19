import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

/**
 * A hash of the crosswalks a database holds and the areas their edges join, so
 * weights computed from one database are only copied into one with the same
 * ids. The weights name crosswalks and area versions by integer id. Each
 * crosswalk's content hash is in the database's build metadata, `build`.
 */
export const crosswalkSetHash = (
	database: DatabaseSync,
	build: DatabaseSync,
) => {
	const hashes = new Map(
		build
			.prepare("SELECT slug, content_hash FROM crosswalk_build")
			.all()
			.map((row) => [row.slug as string, row.content_hash as string]),
	);
	const hash = createHash("sha256");
	for (const row of database
		.prepare(
			"SELECT c.id AS id, c.slug AS slug, (SELECT count(*) FROM crosswalk_edge e WHERE e.crosswalk_id = c.id) AS edges, (SELECT coalesce(sum(e.from_version_id * 31 + e.to_version_id), 0) FROM crosswalk_edge e WHERE e.crosswalk_id = c.id) AS ids FROM crosswalk c ORDER BY c.id",
		)
		.all())
		hash.update(
			`${row.id}|${row.slug}|${hashes.get(row.slug as string)}|${row.edges}|${row.ids}\n`,
		);
	return `sha256:${hash.digest("hex")}`;
};
