import type { DatabaseSync } from "node:sqlite";

export const DATASETS_VIEW = "SELECT type, output, source, contract, summary, fingerprint, sha256, bytes, payload_id AS payloadId FROM dataset_catalogue";

/** Read-only aliases for database consumers using retired names. */
export function createDeprecatedViews(database: DatabaseSync) {
	database.exec("CREATE VIEW website_assets AS SELECT kind, id, sha256, gzip FROM website_asset");
}
