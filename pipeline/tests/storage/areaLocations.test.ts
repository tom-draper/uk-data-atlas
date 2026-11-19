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
			CREATE TABLE area_release(id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
			CREATE TABLE area_version(id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
			INSERT INTO area VALUES (1,'a'),(2,'b'); INSERT INTO area_release VALUES (1,'ward','2024');
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
		CREATE TABLE area_release(id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
		CREATE TABLE area_version(id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
		INSERT INTO area VALUES (1,'a'),(2,'b');
		INSERT INTO area_release VALUES (1,'outputArea','2021-12-ew-bgc-v2'),(2,'outputArea','2011');
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

test("worker jobs stay within a release and are written in the order a single thread would write them", async () => {
	const { DatabaseSync } = await import("node:sqlite");
	const { writeAreaLocations, locateArea } =
		await import("../../src/storage/areaLocations.ts");
	const square = (offset: number) => ({
		type: "Polygon",
		coordinates: [
			[
				[offset, 51],
				[offset + 1, 51],
				[offset + 1, 52],
				[offset, 52],
				[offset, 51],
			],
		],
	});
	const cache = {
		// Some areas have no geometry, and one is too thin to hold a point.
		get: (_g: string, _r: string, code: string) =>
			code.endsWith("3")
				? undefined
				: code.endsWith("7")
					? {
							type: "Polygon" as const,
							coordinates: [
								[
									[0, 0],
									[1, 0],
									[2, 0],
									[0, 0],
								],
							],
						}
					: square(Number(code.slice(1)) % 50),
	};
	const sources = new Map([
		["ward/2023", {} as never],
		["ward/2024", {} as never],
	]);
	const build = (pool?: Parameters<typeof writeAreaLocations>[6]) => {
		const db = new DatabaseSync(":memory:");
		db.exec(`CREATE TABLE area(id INTEGER PRIMARY KEY, code TEXT);
			CREATE TABLE area_release(id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
			CREATE TABLE area_version(id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
			INSERT INTO area_release VALUES (1,'ward','2024'),(2,'ward','2023'),(3,'ward','2022');`);
		const area = db.prepare("INSERT INTO area VALUES (?, ?)");
		const version = db.prepare("INSERT INTO area_version VALUES (?, ?, ?)");
		for (let at = 1; at <= 5000; at++) {
			area.run(at, `a${at}`);
			// Release 3 has no geometry source: its areas are all gaps.
			version.run(at, at, 1 + (at % 3));
		}
		writeAreaLocations(
			db,
			"",
			pool ? undefined : cache,
			sources,
			new Map(),
			1 + (pool ? 1 : 0),
			pool,
		);
		const rows = db
			.prepare("SELECT * FROM area_location ORDER BY rowid")
			.all();
		db.close();
		return rows;
	};
	const jobs: { geography: string; release: string; codes: string[] }[] = [];
	const taken: number[] = [];
	const results = new Map<number, ReturnType<typeof locateArea>[]>();
	const pool = {
		size: 2,
		submit: (job: (typeof jobs)[number]) => {
			jobs.push(job);
			results.set(
				jobs.length - 1,
				job.codes.map((code) =>
					locateArea(
						cache,
						sources,
						job.geography,
						job.release,
						code,
					),
				),
			);
			return jobs.length - 1;
		},
		take: (ticket: number) => {
			taken.push(ticket);
			return results.get(ticket)!;
		},
	};
	const serial = build();
	const parallel = build(pool);
	assert.equal(serial.length, 5000);
	assert.deepEqual(parallel, serial);
	assert.ok(serial.some((row) => row.method === "polygon-interior-point"));
	assert.ok(serial.some((row) => row.gap === "no-geometry"));
	assert.ok(serial.some((row) => row.gap === "no-interior-point"));
	// Versions are numbered so each release's areas are not consecutive in
	// the table; the jobs follow the query's order, one release at a time.
	assert.ok(jobs.length >= 3);
	const releaseOf = ["2024", "2023", "2022"];
	for (const job of jobs) {
		assert.ok(job.codes.length <= 2000);
		for (const code of job.codes)
			assert.equal(releaseOf[Number(code.slice(1)) % 3], job.release);
	}
	assert.equal(
		jobs.reduce((sum, job) => sum + job.codes.length, 0),
		5000,
	);
	assert.deepEqual(
		taken,
		jobs.map((_, ticket) => ticket),
	);
	assert.deepEqual([...new Set(jobs.map((job) => job.release))].sort(), [
		"2022",
		"2023",
		"2024",
	]);
});

test("the real workers start, and what they cannot read stops the write", async (context) => {
	const { mkdirSync, mkdtempSync, rmSync, writeFileSync } =
		await import("node:fs");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const { DatabaseSync } = await import("node:sqlite");
	const { writeAreaLocations } =
		await import("../../src/storage/areaLocations.ts");
	// A release the registry lists but whose compiled geometry is missing.
	const root = mkdtempSync(join(tmpdir(), "area-location-workers-"));
	context.onTestFinished(() =>
		rmSync(root, { recursive: true, force: true }),
	);
	mkdirSync(join(root, "data/build/artifacts"), { recursive: true });
	writeFileSync(
		join(root, "data/build/artifacts/geometry-sources.json"),
		JSON.stringify({
			schemaVersion: 1,
			releases: [
				{
					id: "ward/2024",
					status: "available",
					input: "wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "code",
				},
			],
		}),
	);
	const db = new DatabaseSync(":memory:");
	context.onTestFinished(() => db.close());
	db.exec(`CREATE TABLE area(id INTEGER PRIMARY KEY, code TEXT);
		CREATE TABLE area_release(id INTEGER PRIMARY KEY, geography TEXT, release TEXT);
		CREATE TABLE area_version(id INTEGER PRIMARY KEY, area_id INTEGER, release_id INTEGER);
		INSERT INTO area VALUES (1,'a');
		INSERT INTO area_release VALUES (1,'ward','2024');
		INSERT INTO area_version VALUES (1,1,1);`);
	assert.throws(
		() =>
			writeAreaLocations(
				db,
				root,
				undefined,
				new Map([["ward/2024", {} as never]]),
				new Map(),
				2,
			),
		/Cannot use compiled geometry for ward\/2024/,
	);
});
