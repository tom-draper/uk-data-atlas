import { DatabaseSync } from "node:sqlite";

/**
 * A database holding only the tables the change events read, with a ward
 * geography released in three editions: 2020 (A, B, C, D), 2021 (A, B2, C, D)
 * and 2022 (A, B2, C, E).
 */
export const fixture = () => {
	const db = new DatabaseSync(":memory:");
	db.exec(`
		CREATE TABLE geography (id INTEGER PRIMARY KEY, slug TEXT);
		CREATE TABLE area (id INTEGER PRIMARY KEY, geography_id INTEGER, code TEXT);
		CREATE TABLE area_release (id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
		CREATE TABLE boundary_release_edition (geography TEXT, release TEXT, edition_from TEXT);
		CREATE TABLE area_version (id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER, name TEXT, in_inventory INTEGER);
		CREATE TABLE crosswalk (id INTEGER PRIMARY KEY, slug TEXT, method TEXT, purpose TEXT, from_release_id INTEGER, to_release_id INTEGER, validation TEXT);
		CREATE TABLE crosswalk_edge (crosswalk_id INTEGER, from_version_id INTEGER, to_version_id INTEGER);
		CREATE TABLE crosswalk_source (crosswalk_id INTEGER, from_version_id INTEGER, coverage REAL);
		CREATE TABLE crosswalk_weight (crosswalk_id INTEGER, from_version_id INTEGER, to_version_id INTEGER, basis_id TEXT, weight REAL);
		CREATE TABLE area_relationship (parent_version_id INTEGER, child_version_id INTEGER, relation TEXT);
		INSERT INTO geography VALUES (1, 'ward');
	`);
	const areaIds = new Map<string, number>();
	const versions = new Map<string, number>();
	const release = (id: number, name: string, edition: string, areas: Array<[string, string]>) => {
		db.prepare("INSERT INTO area_release VALUES (?, 'ward', ?)").run(id, name);
		db.prepare("INSERT INTO boundary_release_edition VALUES ('ward', ?, ?)").run(name, edition);
		for (const [code, label] of areas) {
			if (!areaIds.has(code)) {
				areaIds.set(code, areaIds.size + 1);
				db.prepare("INSERT INTO area VALUES (?, 1, ?)").run(areaIds.get(code), code);
			}
			const version = versions.size + 1;
			versions.set(`${name}|${code}`, version);
			db.prepare("INSERT INTO area_version VALUES (?, ?, ?, ?, 1)").run(version, areaIds.get(code), id, label);
		}
	};
	release(1, "2020", "2020-12-01", [["A", "Alpha"], ["B", "Beta"], ["C", "Gamma"], ["D", "Delta"]]);
	release(2, "2021", "2021-12-01", [["A", "Alpha"], ["B2", "Beta"], ["C", "Gamma"], ["D", "Delta"]]);
	release(3, "2022", "2022-12-01", [["A", "Alpha"], ["B2", "Beta"], ["C", "Gamma"], ["E", "Epsilon"]]);
	const v = (release: string, code: string) => versions.get(`${release}|${code}`)!;
	return { db, v };
};

export const edge = (db: DatabaseSync, id: number, from: number, to: number) =>
	db.prepare("INSERT INTO crosswalk_edge VALUES (?, ?, ?)").run(id, from, to);
