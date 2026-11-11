import type { DatabaseSync } from "node:sqlite";

export const NAMED_LOCATION_PARTIAL_MEMBERS_VIEW =
	"SELECT location_id AS locationId, position, code, share, member_of AS memberOf FROM named_location_partial_member";
export const NAMED_LOCATION_GEOMETRIES_VIEW =
	"SELECT location_id AS locationId, boundary_release AS boundaryRelease, min_x AS minX, min_y AS minY, max_x AS maxX, max_y AS maxY, geometry FROM named_location_geometry";
export const CROSSWALK_INVENTORY_VIEW =
	"SELECT position, schema_version AS schemaVersion, content_hash AS contentHash, area_inventory_hash AS areaInventoryHash FROM crosswalk_inventory_metadata";
export const CROSSWALK_COVERAGE_VIEW =
	"SELECT geography, boundary_release AS boundaryRelease, position, area_count AS areaCount, related_area_count AS relatedAreaCount FROM crosswalk_coverage_entry";
export const AREA_INVENTORY_VIEW =
	"SELECT position, schema_version AS schemaVersion, content_hash AS contentHash, boundary_registry_hash AS boundaryRegistryHash FROM area_inventory_metadata";
export const DATASETS_VIEW =
	"SELECT type, output, source, contract, summary, fingerprint, sha256, bytes, payload_id AS payloadId FROM dataset_catalogue";

/** Read-only aliases for database consumers using retired names. */
export function createDeprecatedViews(database: DatabaseSync) {
	database.exec(
		"CREATE VIEW website_assets AS SELECT kind, id, sha256, gzip FROM website_asset",
	);
}
