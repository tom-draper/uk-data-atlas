import type { DatabaseSync } from "node:sqlite";

export const PLACE_INDEX_PLACES_VIEW = "SELECT * FROM place_index_place";
export const PLACE_INDEX_NAMES_VIEW = "SELECT * FROM place_index_name";
export const PLACE_INDEX_CODES_VIEW = "SELECT * FROM place_index_code";
export const AREA_SEARCH_CODES_VIEW = "SELECT * FROM area_search_code";
export const AREA_SEARCH_TERMS_VIEW = "SELECT * FROM area_search_term";
export const AREA_SEARCH_TITLE_TERMS_VIEW = "SELECT * FROM area_search_title_term";
export const LOCATION_PROJECTION_MEMBERS_VIEW = "SELECT crosswalk_id AS crosswalkId, key, value FROM location_projection_member";
export const LOCATION_PROJECTION_PARENTS_VIEW = "SELECT crosswalk_id AS crosswalkId, key, value FROM location_projection_parent";
export const LOCATION_PROJECTION_DICTIONARIES_VIEW = "SELECT kind, crosswalk_id AS crosswalkId, dictionary FROM location_projection_dictionary";
export const CACHE_GENERATIONS_VIEW = "SELECT component, generation FROM cache_generation";
export const DATASET_PAYLOADS_VIEW = "SELECT output, source_sha256, sha256, bytes, gzip FROM dataset_payload";
export const NAMED_LOCATIONS_VIEW = "SELECT id, position, fields, label, kind, definition_revision AS definitionRevision, member_geography AS memberGeography, valid_from AS validFrom, valid_to AS validTo, min_x AS minX, min_y AS minY, max_x AS maxX, max_y AS maxY, source FROM named_location";
export const NAMED_LOCATION_MEMBERS_VIEW = "SELECT location_id AS locationId, position, code FROM named_location_member";
export const NAMED_LOCATION_ASSERTIONS_VIEW = "SELECT location_id AS locationId, position, code, valid_from AS validFrom, valid_to AS validTo FROM named_location_assertion";
export const NAMED_LOCATION_PARTIAL_MEMBERS_VIEW = "SELECT location_id AS locationId, position, code, share, member_of AS memberOf FROM named_location_partial_member";
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
