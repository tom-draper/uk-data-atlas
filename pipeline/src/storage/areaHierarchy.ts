import type { DatabaseSync } from "node:sqlite";

/** Materialise only crosswalks that explicitly describe membership or best fit. */
export function writeAreaHierarchy(database: DatabaseSync) {
	database.exec(`CREATE TABLE area_hierarchy (
		child_version_id INTEGER NOT NULL REFERENCES area_version(id),
		parent_version_id INTEGER NOT NULL REFERENCES area_version(id),
		crosswalk_id INTEGER NOT NULL REFERENCES crosswalk(id),
		accuracy TEXT NOT NULL CHECK (accuracy IN ('exact', 'approximate')),
		PRIMARY KEY (child_version_id, parent_version_id, crosswalk_id)
	) STRICT, WITHOUT ROWID;
	CREATE INDEX area_hierarchy_parent ON area_hierarchy(parent_version_id, child_version_id);
	INSERT INTO area_hierarchy
	SELECT e.from_version_id, e.to_version_id, e.crosswalk_id,
		CASE WHEN c.method = 'clean-containment' THEN 'exact' ELSE 'approximate' END
	FROM crosswalk_edge e JOIN crosswalk c ON c.id = e.crosswalk_id
	WHERE c.method IN ('clean-containment', 'geometric-containment', 'best-fit')
		OR (c.method = 'official-lookup' AND c.purpose = 'membership');`);
}
