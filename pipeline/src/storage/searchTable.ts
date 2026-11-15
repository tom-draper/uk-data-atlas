import type { DatabaseSync } from "node:sqlite";

/**
 * The `search` table: one full-text index over what a reader looks for by
 * name. Measures, datasets, dimension members, areas and places each add
 * rows, so one query finds a measure about households, the area called
 * Manchester or the historic county of that name.
 *
 * An area has one row, holding its code and the name it has on its latest
 * boundary release, not a row per release: that would add a row for every
 * rename and boundary change to a table people search for the current name.
 */
export function writeSearchTable(database: DatabaseSync): void {
	// `kind` is not indexed, so a query for "measure" finds nothing by it: it
	// only filters. Words match their stems.
	database.exec(
		"CREATE VIRTUAL TABLE search USING fts5(kind UNINDEXED, key, label, body, tokenize = 'porter unicode61')",
	);
	database.exec(`
INSERT INTO search (kind, key, label, body)
	SELECT 'measure', slug, label, description || ' ' || unit FROM measure ORDER BY id;
INSERT INTO search (kind, key, label, body)
	SELECT 'dataset', slug, title, description || ' ' || module FROM dataset ORDER BY id;
INSERT INTO search (kind, key, label, body)
	SELECT 'dimension_member', d.slug || ':' || m.code, m.label, d.label
	FROM dimension_member m JOIN dimension d ON d.id = m.dimension_id ORDER BY m.id;
INSERT INTO search (kind, key, label, body)
	SELECT 'area', c.code, c.name, c.geography FROM v_area_current c ORDER BY c.area_id;
INSERT INTO search (kind, key, label, body)
	SELECT 'place', id, label, kind || ' ' || member_geography FROM named_location ORDER BY position;
INSERT INTO search (search) VALUES ('optimize')`);
}
