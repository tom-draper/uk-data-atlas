import type { DatabaseSync } from "node:sqlite";

export const PLACE_INDEX_PLACES_VIEW = "SELECT * FROM place_index_place";
export const PLACE_INDEX_NAMES_VIEW = "SELECT * FROM place_index_name";
export const PLACE_INDEX_CODES_VIEW = "SELECT * FROM place_index_code";
export const AREA_SEARCH_CODES_VIEW = "SELECT * FROM area_search_code";
export const AREA_SEARCH_TERMS_VIEW = "SELECT * FROM area_search_term";
export const AREA_SEARCH_TITLE_TERMS_VIEW = "SELECT * FROM area_search_title_term";
export const DATASETS_VIEW = "SELECT type, output, source, contract, summary, fingerprint, sha256, bytes, payload_id AS payloadId FROM dataset_catalogue";

/** Read-only aliases for database consumers using retired names. */
export function createDeprecatedViews(database: DatabaseSync) {
	database.exec("CREATE VIEW website_assets AS SELECT kind, id, sha256, gzip FROM website_asset");
}

/** Remove an old table or view before rebuilding its replacement in a cache copy. */
export function removeDeprecatedObject(database: DatabaseSync, name: string) {
	const row = database.prepare("SELECT type FROM sqlite_schema WHERE name = ? AND type IN ('table', 'view')").get(name);
	if (row?.type === "table") database.exec(`DROP TABLE "${name}"`);
	else if (row?.type === "view") database.exec(`DROP VIEW "${name}"`);
}
