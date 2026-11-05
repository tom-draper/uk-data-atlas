import type { DatabaseSync } from "node:sqlite";

/** Read-only aliases for database consumers using retired names. */
export function createDeprecatedViews(database: DatabaseSync) {
	database.exec("CREATE VIEW website_assets AS SELECT kind, id, sha256, gzip FROM website_asset");
}
