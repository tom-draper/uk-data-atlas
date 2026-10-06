import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import {
	AreaGeometryCache,
	compiledGeometryFile,
	type GeoJsonGeometry,
	type GeometrySource,
	type GeometrySourceLookup,
} from "../src/areaGeometry";
import { encodeGeometryStore, readGeometryStore } from "../src/geometryStore";
import { packGeometry, unpackGeometry } from "../src/packedGeometry";

const square = (west: number, south: number, size: number) => [
	[
		[west, south],
		[west + size, south],
		[west + size, south + size],
		[west, south + size],
		[west, south],
	],
];

test("reads back every kind of packed area exactly as it was written", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "atlas-geometry-store-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const areas: Array<[string, GeoJsonGeometry]> = [
		["A", { type: "Polygon", coordinates: square(-1.5, 53.25, 0.125) }],
		[
			"B",
			{
				type: "MultiPolygon",
				coordinates: [square(0, 50, 1), square(2, 50, 0.5)],
			},
		],
		// Two features with one code arrive as a collection.
		[
			"C",
			{
				type: "GeometryCollection",
				geometries: [
					{ type: "Polygon", coordinates: square(4, 50, 1) },
					{ type: "Point", coordinates: [4.5, 50.5] },
				],
			},
		],
		// Positions of mixed length cannot be packed and are kept as they came.
		[
			"D",
			{
				type: "LineString",
				coordinates: [
					[1, 2],
					[3, 4, 5],
				],
			},
		],
		["E", { type: "MultiPolygon", coordinates: [] }],
	];
	const source: GeometrySource = {
		input: "boundaries/example.geojson",
		crs: "EPSG:4326",
		codeProperty: "CODE",
	};
	const path = join(directory, "release.bin");
	writeFileSync(
		path,
		encodeGeometryStore(
			source,
			areas.map(([code, geometry]) => [code, packGeometry(geometry)]),
		),
	);
	const stored = readGeometryStore(path, source)!;
	t.after(() => stored.close());
	assert.deepEqual(stored.codes, ["A", "B", "C", "D", "E"]);
	for (const [code, geometry] of areas)
		assert.deepEqual(unpackGeometry(stored.get(code)!), geometry, code);
	assert.equal(stored.get("Z"), undefined);
	assert.deepEqual(stored.bounds("B"), [0, 50, 2.5, 51]);
	assert.deepEqual(stored.bounds("C"), [4, 50, 5, 51]);
	assert.equal(stored.bounds("E"), undefined);
	assert.deepEqual(
		[...stored.spatialIndex.candidates([0.25, 50.25, 0.25, 50.25])],
		["B"],
	);
	assert.ok(stored.spatialIndex.cellCount > 0);

	// A file compiled from another source is never read in its place.
	assert.equal(
		readGeometryStore(path, { ...source, inputHash: "sha256:changed" }),
		undefined,
	);
});

/** A British National Grid release, so reading it means reprojecting it. */
const gridRelease = (t: TestContext) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-geometry-store-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const directory = join(root, "data", "boundaries", "ward");
	mkdirSync(directory, { recursive: true });
	const metres = (east: number, north: number) => square(east, north, 1000);
	writeFileSync(
		join(directory, "wards.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			features: [
				["E05000001", metres(430000, 433000)],
				["E05000002", metres(431000, 433000)],
				["E05000003", metres(440000, 440000)],
			].map(([code, coordinates]) => ({
				properties: { WD25CD: code },
				geometry: { type: "Polygon", coordinates },
			})),
		}),
	);
	const sources: GeometrySourceLookup = new Map([
		[
			"ward/2025-05-uk-bgc",
			{
				input: "boundaries/ward/wards.geojson",
				crs: "EPSG:27700",
				codeProperty: "WD25CD",
			},
		],
	]);
	return { root, sources, store: join(root, "store") };
};

test("serves a compiled release exactly as it serves the release's source", (t) => {
	const { root, sources, store } = gridRelease(t);
	mkdirSync(store);
	const compiler = new AreaGeometryCache(root, sources);
	writeFileSync(
		join(store, compiledGeometryFile("ward", "2025-05-uk-bgc")),
		encodeGeometryStore(
			sources.get("ward/2025-05-uk-bgc")!,
			compiler.compile("ward", "2025-05-uk-bgc"),
		),
	);

	const fromSource = new AreaGeometryCache(root, sources);
	const compiled = new AreaGeometryCache(root, sources, 2, store);
	compiled.warm([["ward", "2025-05-uk-bgc"]]);
	assert.deepEqual(compiled.stats().loadedReleases, ["ward/2025-05-uk-bgc"]);
	assert.equal(compiled.stats().spatialIndexBuilds, 0);
	const ask = (cache: AreaGeometryCache) => {
		const point = cache.get("ward", "2025-05-uk-bgc", "E05000001")!
			.coordinates as number[][][];
		const [longitude, latitude] = point[0]![0]!;
		return {
			codes: cache.codes("ward", "2025-05-uk-bgc"),
			areas: ["E05000001", "E05000002", "E05000003"].map((code) =>
				cache.get("ward", "2025-05-uk-bgc", code),
			),
			containing: cache.findContaining("ward", "2025-05-uk-bgc", [
				longitude! + 0.001,
				latitude! + 0.001,
			]),
			neighbours: cache.findNeighbours(
				"ward",
				"2025-05-uk-bgc",
				"E05000001",
			),
			intersecting: cache.findIntersecting(
				"ward",
				"2025-05-uk-bgc",
				[-2, 53, 0, 55],
			),
		};
	};
	const expected = ask(fromSource);
	assert.equal(expected.neighbours!.length, 1);
	assert.deepEqual(ask(compiled), expected);
	assert.equal(compiled.stats().compiledLoads, 1);
	assert.equal(compiled.stats().spatialIndexBuilds, 0);
	assert.equal(fromSource.stats().compiledLoads, 0);
});

test("reads a release from its source when its compiled file is stale", (t) => {
	const { root, sources, store } = gridRelease(t);
	mkdirSync(store);
	const source = sources.get("ward/2025-05-uk-bgc")!;
	writeFileSync(
		join(store, compiledGeometryFile("ward", "2025-05-uk-bgc")),
		encodeGeometryStore(
			{ ...source, inputHash: "sha256:an-older-file" },
			new AreaGeometryCache(root, sources).compile(
				"ward",
				"2025-05-uk-bgc",
			),
		),
	);
	const cache = new AreaGeometryCache(root, sources, 2, store);
	assert.ok(cache.get("ward", "2025-05-uk-bgc", "E05000001"));
	assert.equal(cache.stats().compiledLoads, 0);
	assert.equal(cache.stats().loads, 1);
});
