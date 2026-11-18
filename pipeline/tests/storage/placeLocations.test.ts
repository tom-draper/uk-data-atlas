import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import { packGeometry } from "@uk-data-atlas/atlas-db";
import { writePlaceLocations } from "../../src/storage/placeLocations.ts";

test("named places have an interior point or an explicit gap", () => {
	const build = () => {
		const db = new DatabaseSync(":memory:");
		db.exec(`CREATE TABLE place(id INTEGER PRIMARY KEY);
		CREATE TABLE place_geometry(place_id INTEGER PRIMARY KEY, geometry BLOB);
		INSERT INTO place VALUES (1),(2);`);
		const geometry = packGeometry({
			type: "Polygon",
			coordinates: [
				[
					[0, 51],
					[1, 51],
					[1, 52],
					[0, 52],
					[0, 51],
				],
			],
		});
		db.prepare("INSERT INTO place_geometry VALUES (1, ?)").run(
			geometry.geometry,
		);
		writePlaceLocations(db);
		const rows = db
			.prepare("SELECT * FROM place_location ORDER BY place_id")
			.all();
		assert.equal(rows[0]!.method, "polygon-interior-point");
		assert.ok(
			Number(rows[0]!.longitude) > 0 && Number(rows[0]!.longitude) < 1,
		);
		assert.ok(
			Number(rows[0]!.latitude) > 51 && Number(rows[0]!.latitude) < 52,
		);
		assert.equal(rows[1]!.gap, "no-geometry");
		db.close();
		return rows;
	};
	assert.deepEqual(build(), build());
});
