import assert from "node:assert/strict";
import { test } from "vitest";
import { areaLocation } from "../../src/storage/areaLocations.ts";
import { containPoint } from "@uk-data-atlas/geography";

test("the point lies inside a polygon with a hole and the bounds round outwards", () => {
	const geometry = {
		type: "Polygon",
		coordinates: [
			[
				[-1.1234567, 51],
				[0, 51],
				[0, 52],
				[-1.1234567, 52],
				[-1.1234567, 51],
			],
			[
				[-1, 51.2],
				[-0.2, 51.2],
				[-0.2, 51.8],
				[-1, 51.8],
				[-1, 51.2],
			],
		],
	};
	const location = areaLocation(geometry)!;
	assert.equal(
		containPoint([location.longitude, location.latitude], geometry),
		"interior",
	);
	assert.equal(location.minLongitude, -1.123457);
	assert.deepEqual(areaLocation(geometry), location);
});

test("empty and degenerate polygons do not invent a point", () => {
	assert.equal(areaLocation({ type: "Polygon", coordinates: [] }), undefined);
	assert.equal(
		areaLocation({
			type: "Polygon",
			coordinates: [
				[
					[0, 0],
					[1, 0],
					[2, 0],
					[0, 0],
				],
			],
		}),
		undefined,
	);
});

test("the writer records geometry gaps and produces deterministic rows", async () => {
	const { DatabaseSync } = await import("node:sqlite");
	const { writeAreaLocations } =
		await import("../../src/storage/areaLocations.ts");
	const geometry = {
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
	};
	const build = () => {
		const db = new DatabaseSync(":memory:");
		db.exec(`CREATE TABLE area(id INTEGER PRIMARY KEY, code TEXT);
			CREATE TABLE area_releases(id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
			CREATE TABLE area_version(id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
			INSERT INTO area VALUES (1,'a'),(2,'b'); INSERT INTO area_releases VALUES (1,'ward','2024');
			INSERT INTO area_version VALUES (1,1,1),(2,2,1);`);
		writeAreaLocations(
			db,
			"",
			{ get: (_g, _r, code) => (code === "a" ? geometry : undefined) },
			new Map([["ward/2024", {} as never]]),
			new Map(),
		);
		const rows = db
			.prepare("SELECT * FROM area_location ORDER BY area_version_id")
			.all();
		assert.equal(rows[0]!.method, "polygon-interior-point");
		assert.equal(rows[1]!.gap, "no-geometry");
		db.close();
		return rows;
	};
	assert.deepEqual(build(), build());
});

test("published centroids apply only to their release and within its bounds", async () => {
	const { DatabaseSync } = await import("node:sqlite");
	const { writeAreaLocations } =
		await import("../../src/storage/areaLocations.ts");
	const db = new DatabaseSync(":memory:");
	db.exec(`CREATE TABLE area(id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE area_releases(id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
		CREATE TABLE area_version(id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
		INSERT INTO area VALUES (1,'a'),(2,'b');
		INSERT INTO area_releases VALUES (1,'outputArea','2021-12-ew-bgc-v2'),(2,'outputArea','2011');
		INSERT INTO area_version VALUES (1,1,1),(2,2,1),(3,1,2);`);
	const geometry = {
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
	};
	writeAreaLocations(
		db,
		"",
		{ get: () => geometry },
		new Map([
			["outputArea/2021-12-ew-bgc-v2", {} as never],
			["outputArea/2011", {} as never],
		]),
		new Map([
			["a", [0.2, 51.2]],
			["b", [2, 51.2]],
		]),
	);
	const rows = db
		.prepare(
			"SELECT method, longitude FROM area_location ORDER BY area_version_id",
		)
		.all();
	assert.equal(rows[0]!.method, "ons-population-weighted-2021");
	assert.equal(rows[0]!.longitude, 0.2);
	assert.equal(rows[1]!.method, "polygon-interior-point");
	assert.equal(rows[2]!.method, "polygon-interior-point");
	db.close();
});
