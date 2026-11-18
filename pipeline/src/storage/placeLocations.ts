import type { DatabaseSync } from "node:sqlite";
import { unpackGeometry } from "@uk-data-atlas/atlas-db";
import { areaLocation } from "./areaLocations.ts";

/** One representative point per named place, or an explicit geometry gap. */
export function writePlaceLocations(database: DatabaseSync) {
	database.exec(`CREATE TABLE place_location (
		place_id INTEGER PRIMARY KEY REFERENCES place(id),
		longitude REAL, latitude REAL,
		method TEXT CHECK (method = 'polygon-interior-point'),
		gap TEXT CHECK (gap IN ('no-geometry', 'no-interior-point')),
		CHECK ((gap IS NULL AND method IS NOT NULL AND longitude IS NOT NULL AND latitude IS NOT NULL) OR
		(gap IS NOT NULL AND method IS NULL AND longitude IS NULL AND latitude IS NULL))
	) STRICT`);
	const insert = database.prepare(
		"INSERT INTO place_location VALUES (?, ?, ?, ?, ?)",
	);
	for (const row of database
		.prepare(
			`SELECT p.id, g.geometry FROM place p
		LEFT JOIN place_geometry g ON g.place_id = p.id ORDER BY p.id`,
		)
		.iterate()) {
		const location = row.geometry
			? areaLocation(unpackGeometry(row.geometry))
			: undefined;
		if (location)
			insert.run(
				row.id as number,
				location.longitude,
				location.latitude,
				"polygon-interior-point",
				null,
			);
		else
			insert.run(
				row.id as number,
				null,
				null,
				null,
				row.geometry ? "no-interior-point" : "no-geometry",
			);
	}
}
