import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
	AreaGeometryCache,
	type GeometrySourceLookup,
} from "../src/areaGeometry";
import { toWgs84Geometry } from "../src/reprojection";

const writeSource = (root: string, input: string, geojson: unknown) => {
	const path = join(root, "data", input);
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(path, JSON.stringify(geojson));
};

test("returns a single feature's geometry directly", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeSource(root, "boundaries/ward/2025/wards.geojson", {
			type: "FeatureCollection",
			features: [
				{
					properties: { WD25CD: "E05000001" },
					geometry: { type: "Polygon", coordinates: [] },
				},
			],
		});
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025",
				{
					input: "boundaries/ward/2025/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const cache = new AreaGeometryCache(root, sources);
		const geometry = cache.get("ward", "2025", "E05000001");
		assert.deepEqual(geometry, { type: "Polygon", coordinates: [] });
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("merges duplicate-coded fragments into a GeometryCollection", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeSource(root, "boundaries/ward/2022/wards.geojson", {
			type: "FeatureCollection",
			features: [
				{
					properties: { WD22CD: "E05014284" },
					geometry: { type: "Polygon", coordinates: [1] },
				},
				{
					properties: { WD22CD: "E05014284" },
					geometry: { type: "Polygon", coordinates: [2] },
				},
			],
		});
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2022",
				{
					input: "boundaries/ward/2022/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD22CD",
				},
			],
		]);
		const cache = new AreaGeometryCache(root, sources);
		const geometry = cache.get("ward", "2022", "E05014284");
		assert.equal(geometry?.type, "GeometryCollection");
		assert.deepEqual(
			geometry?.geometries?.map((part) => part.coordinates),
			[[1], [2]],
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("returns undefined for a code absent from an otherwise available source", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeSource(root, "boundaries/ward/2025/wards.geojson", {
			type: "FeatureCollection",
			features: [
				{
					properties: { WD25CD: "E05000001" },
					geometry: { type: "Point", coordinates: [0, 0] },
				},
			],
		});
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025",
				{
					input: "boundaries/ward/2025/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "WD25CD",
				},
			],
		]);
		const cache = new AreaGeometryCache(root, sources);
		assert.equal(cache.get("ward", "2025", "E05099999"), undefined);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("throws when no geometry source is registered for the identity", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const cache = new AreaGeometryCache(root, new Map());
		assert.throws(
			() => cache.get("ward", "2025", "E05000001"),
			/No raw geometry source is available for ward\/2025/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("states the source file and its hash in geometry provenance", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const source = {
			input: "boundaries/ward/2025/wards.geojson",
			crs: "EPSG:4326",
			codeProperty: "WD25CD",
		};
		const hashed = new AreaGeometryCache(
			root,
			new Map([["ward/2025", { ...source, inputHash: "sha256:wards" }]]),
		);
		assert.deepEqual(hashed.provenance("ward", "2025"), {
			input: "boundaries/ward/2025/wards.geojson",
			inputHash: "sha256:wards",
			sourceCrs: "EPSG:4326",
		});
		// A registry built before hashes were recorded still serves.
		const unhashed = new AreaGeometryCache(
			root,
			new Map([["ward/2025", source]]),
		);
		assert.deepEqual(unhashed.provenance("ward", "2025"), {
			sourceCrs: "EPSG:4326",
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("refuses a geometry source with no transformation to WGS84", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/2025",
				{
					input: "boundaries/ward/2025/wards.geojson",
					crs: "EPSG:3857",
					codeProperty: "WD25CD",
				},
			],
		]);
		const cache = new AreaGeometryCache(root, sources);
		for (const read of [
			() => cache.get("ward", "2025", "E05000001"),
			() => cache.provenance("ward", "2025"),
		]) {
			assert.throws(
				read,
				/No transformation to WGS84 is available for geometry in EPSG:3857\./,
			);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("re-reads a source after it is evicted from a bounded cache", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeSource(root, "boundaries/ward/a/wards.geojson", {
			type: "FeatureCollection",
			features: [
				{
					properties: { CD: "A1" },
					geometry: { type: "Point", coordinates: [0, 0] },
				},
			],
		});
		writeSource(root, "boundaries/ward/b/wards.geojson", {
			type: "FeatureCollection",
			features: [
				{
					properties: { CD: "B1" },
					geometry: { type: "Point", coordinates: [1, 1] },
				},
			],
		});
		const sources: GeometrySourceLookup = new Map([
			[
				"ward/a",
				{
					input: "boundaries/ward/a/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "CD",
				},
			],
			[
				"ward/b",
				{
					input: "boundaries/ward/b/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "CD",
				},
			],
		]);
		const cache = new AreaGeometryCache(root, sources, 1);
		assert.deepEqual(cache.get("ward", "a", "A1"), {
			type: "Point",
			coordinates: [0, 0],
		});
		assert.deepEqual(cache.get("ward", "b", "B1"), {
			type: "Point",
			coordinates: [1, 1],
		});
		assert.deepEqual(cache.get("ward", "a", "A1"), {
			type: "Point",
			coordinates: [0, 0],
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("reprojects British National Grid geometry to WGS84 when an area is read", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		const directory = join(root, "data", "boundaries", "ward", "2016");
		mkdirSync(directory, { recursive: true });
		writeFileSync(
			join(directory, "wards.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [
					{
						properties: { wd16cd: "E05000001" },
						geometry: {
							type: "Polygon",
							coordinates: [
								[
									[530000, 180000],
									[530100, 180000],
									[530100, 180100],
									[530000, 180000],
								],
							],
						},
					},
					{
						properties: { wd16cd: "N08000001" },
						geometry: {
							type: "Point",
							coordinates: [146000, 530000],
						},
					},
				],
			}),
		);
		// The cache reads the shared correction from the repository.
		writeFileSync(
			join(root, "data", "boundaries", "northern-ireland-offset.json"),
			readFileSync(
				new URL(
					"../../data/boundaries/northern-ireland-offset.json",
					import.meta.url,
				),
				"utf8",
			),
		);
		const cache = new AreaGeometryCache(
			root,
			new Map([
				[
					"ward/2016",
					{
						input: "boundaries/ward/2016/wards.geojson",
						crs: "EPSG:27700",
						codeProperty: "wd16cd",
						corrections: ["northern-ireland-offset"],
					},
				],
			]),
		);
		const geometry = cache.get("ward", "2016", "E05000001") as {
			coordinates: number[][][];
		};
		// PROJ's cct gives -0.128353940, 51.503990828 for the first vertex
		// through the same EPSG:1314 Helmert pipeline.
		assert.deepEqual(geometry.coordinates[0][0], [-0.1283539, 51.5039908]);
		assert.equal(geometry.coordinates[0].length, 4);
		assert.equal(cache.get("ward", "2016", "E05000001"), geometry);
		// A Northern Ireland area is moved by the declared offset before it is
		// reprojected: about 66 m east and 11 m south here, near Belfast.
		const belfast = cache.get("ward", "2016", "N08000001") as {
			coordinates: [number, number];
		};
		const uncorrected = toWgs84Geometry(
			{ type: "Point", coordinates: [146000, 530000] },
			"EPSG:27700",
		) as unknown as { coordinates: [number, number] };
		const shift = Math.hypot(
			(belfast.coordinates[0] - uncorrected.coordinates[0]) *
				111320 *
				Math.cos((54.6 * Math.PI) / 180),
			(belfast.coordinates[1] - uncorrected.coordinates[1]) * 110574,
		);
		assert.ok(Math.abs(shift - 66.8) < 0.5, `moved ${shift} m`);
		assert.deepEqual(
			cache
				.provenance("ward", "2016", "N08000001")
				.corrections?.map(({ id }) => id),
			["northern-ireland-offset"],
		);
		assert.equal(
			cache.provenance("ward", "2016", "E05000001").corrections,
			undefined,
		);
		assert.deepEqual(cache.provenance("ward", "2016"), {
			sourceCrs: "EPSG:27700",
			transformation: {
				name: "OSGB36 to WGS 84 (6)",
				epsg: "EPSG:1314",
				accuracyM: 2,
				areaOfUse: "Great Britain onshore and the Isle of Man.",
			},
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("uses one compact spatial candidate index for point, nearby and box lookups", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeSource(root, "boundaries/ward/2025/wards.geojson", {
			type: "FeatureCollection",
			features: [
				{
					properties: { CD: "WEST" },
					geometry: {
						type: "Polygon",
						coordinates: [
							[
								[-3, 50],
								[-2, 50],
								[-2, 51],
								[-3, 50],
							],
						],
					},
				},
				{
					properties: { CD: "CENTRE" },
					geometry: {
						type: "Polygon",
						coordinates: [
							[
								[-0.1, 51],
								[0.1, 51],
								[0.1, 51.2],
								[-0.1, 51],
							],
						],
					},
				},
				{
					properties: { CD: "EAST" },
					geometry: {
						type: "Polygon",
						coordinates: [
							[
								[2, 53],
								[3, 53],
								[3, 54],
								[2, 53],
							],
						],
					},
				},
			],
		});
		const cache = new AreaGeometryCache(
			root,
			new Map([
				[
					"ward/2025",
					{
						input: "boundaries/ward/2025/wards.geojson",
						crs: "EPSG:4326",
						codeProperty: "CD",
					},
				],
			]),
		);
		assert.deepEqual(cache.findContaining("ward", "2025", [0, 51.05]), [
			{ code: "CENTRE", containment: "interior" },
		]);
		assert.deepEqual(cache.findNearest("ward", "2025", [0, 51.05], 1000), [
			{ code: "CENTRE", distanceM: 0 },
		]);
		assert.deepEqual(
			cache
				.findIntersecting("ward", "2025", [-0.2, 50.9, 0.2, 51.3])
				.map(({ code, relation }) => ({ code, relation })),
			[{ code: "CENTRE", relation: "within" }],
		);
		assert.deepEqual(
			cache.stats().spatialIndexes.map(({ areas, cells }) => ({
				areas,
				cells,
			})),
			[{ areas: 3, cells: 52 }],
		);
		assert.equal(cache.stats().spatialIndexBuilds, 1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("builds spatial candidates from transformed British National Grid envelopes", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeSource(root, "boundaries/ward/2016/wards.geojson", {
			type: "FeatureCollection",
			features: [
				{
					properties: { CD: "E05000001" },
					geometry: {
						type: "Polygon",
						coordinates: [
							[
								[530000, 180000],
								[530100, 180000],
								[530100, 180100],
								[530000, 180100],
								[530000, 180000],
							],
						],
					},
				},
			],
		});
		const cache = new AreaGeometryCache(
			root,
			new Map([
				[
					"ward/2016",
					{
						input: "boundaries/ward/2016/wards.geojson",
						crs: "EPSG:27700",
						codeProperty: "CD",
					},
				],
			]),
		);
		const point = toWgs84Geometry(
			{ type: "Point", coordinates: [530050, 180050] },
			"EPSG:27700",
		) as unknown as { coordinates: [number, number] };
		assert.deepEqual(
			cache.findContaining("ward", "2016", point.coordinates),
			[{ code: "E05000001", containment: "interior" }],
		);
		assert.equal(cache.stats().spatialIndexBuilds, 1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
