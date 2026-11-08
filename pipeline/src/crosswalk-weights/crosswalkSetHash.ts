import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

/**
 * A hash of the crosswalks a database holds and the areas their edges join, so
 * weights computed from one database are only copied into one with the same
 * ids. The weights name crosswalks and area versions by integer id.
 */
export const crosswalkSetHash = (database: DatabaseSync) => {
	const hash = createHash("sha256");
	for (const row of database
		.prepare(
			"SELECT c.id AS id, c.slug AS slug, c.content_hash AS hash, (SELECT count(*) FROM crosswalk_edge e WHERE e.crosswalk_id = c.id) AS edges, (SELECT coalesce(sum(e.from_version_id * 31 + e.to_version_id), 0) FROM crosswalk_edge e WHERE e.crosswalk_id = c.id) AS ids FROM crosswalk c ORDER BY c.id",
		)
		.all())
		hash.update(
			`${row.id}|${row.slug}|${row.hash}|${row.edges}|${row.ids}\n`,
		);
	return `sha256:${hash.digest("hex")}`;
};
