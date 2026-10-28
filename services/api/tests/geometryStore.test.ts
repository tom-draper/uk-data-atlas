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
} from "@uk-data-atlas/atlas-runtime/geometry";
import {
	encodeGeometryStore,
	readGeometryStore,
} from "@uk-data-atlas/atlas-runtime/geometry";
import { createAreaGeometryCache } from "@uk-data-atlas/atlas-runtime/geometry";
import {
	packGeometry,
	unpackGeometry,
} from "@uk-data-atlas/geography/packed-geometry";
import { artifactRoot } from "@uk-data-atlas/atlas-runtime/storage";

const square = (west: number, south: number, size: number) => [
	[
		[west, south],
		[west + size, south],
		[west + size, south + size],
		[west, south + size],
		[west, south],
	],
];

test("compiles repeated codes and ignores non-object features, keeping seven decimal places", (t) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-geometry-source-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/source"), { recursive: true });
	writeFileSync(
		join(root, "data/source", "source.geojson"),
		'{"type":"FeatureCollection","features":[null,17,[],{"properties":{"CODE":"A"},"geometry":{"type":"Point","coordinates":[-0,1.2345678901234567]}},{"properties":{"CODE":"A"},"geometry":{"type":"GeometryCollection","geometries":[{"type":"Point","coordinates":[1e-7,53.123456789012344]}]}}]}',
	);
	const source: GeometrySource = {
		input: "source.geojson",
		crs: "EPSG:4326",
		codeProperty: "CODE",
	};
	const path = join(root, "release.bin");
	writeFileSync(
		path,
		encodeGeometryStore(
			source,
			new AreaGeometryCache(
				root,
				new Map([["test/release", source]]),
			).compile("test", "release"),
		),
	);
	const stored = readGeometryStore(path, source)!;
	t.after(() => stored.close());
	assert.deepEqual(stored.codes, ["A"]);
	assert.deepEqual(unpackGeometry(stored.get("A")!), {
		type: "GeometryCollection",
		geometries: [
			{ type: "Point", coordinates: [0, 1.2345679] },
			{
				type: "GeometryCollection",
				geometries: [
					{ type: "Point", coordinates: [1e-7, 53.1234568] },
				],
			},
		],
	});
});

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
		// Held as steps: on the 1e-7 grid, with a third number per position.
		[
			"F",
			{
				type: "LineString",
				coordinates: [
					[-0.0944786, 51.519761, 12.5],
					[-0.0957646, 51.5200704, -3],
					[179.9999999, -89.9999999, 0],
				],
			},
		],
		// A step past 32 bits, then a value off the grid, held as f64.
		[
			"G",
			{
				type: "LineString",
				coordinates: [
					[-179.9999999, 0],
					[179.9999999, 0],
				],
			},
		],
		["H", { type: "Point", coordinates: [-0.094478614999957, 51.5] }],
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
	assert.deepEqual(stored.codes, ["A", "B", "C", "D", "E", "F", "G", "H"]);
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
	const directory = join(root, "data/source", "boundaries", "ward");
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
	assert.deepEqual(compiled.stats().spatialIndexes, [
		{ release: "ward/2025-05-uk-bgc", areas: 3, cells: 2 },
	]);
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
			nearest: cache.findNearest(
				"ward",
				"2025-05-uk-bgc",
				[longitude! + 0.001, latitude! + 0.001],
				1000,
			),
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
	assert.equal(compiled.stats().staleCompiledLoads, 0);
});

test("warms a source release's spatial index before its first lookup", (t) => {
	const { root, sources } = gridRelease(t);
	const cache = new AreaGeometryCache(root, sources);
	cache.warm([["ward", "2025-05-uk-bgc"]]);

	assert.equal(cache.stats().spatialIndexBuilds, 1);
	assert.deepEqual(cache.stats().spatialIndexes, [
		{ release: "ward/2025-05-uk-bgc", areas: 3, cells: 2 },
	]);
});

test("rejects a stale compiled release before any request and reports the rebuild", (t) => {
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
	const stale: string[] = [];
	writeFileSync(join(root, "data/source", source.input), "not JSON");
	assert.throws(
		() =>
			new AreaGeometryCache(root, sources, 2, store, (release) =>
				stale.push(release),
			),
		/does not match the registered source.*data:build --only geometry-store/,
	);
	assert.deepEqual(stale, ["ward/2025-05-uk-bgc"]);
});

test("requires compiled metadata for every registered release before use", (t) => {
	const { root, sources, store } = gridRelease(t);
	mkdirSync(store);
	const source = sources.get("ward/2025-05-uk-bgc")!;
	writeFileSync(
		join(store, compiledGeometryFile("ward", "2025-05-uk-bgc")),
		encodeGeometryStore(
			source,
			new AreaGeometryCache(root, sources).compile(
				"ward",
				"2025-05-uk-bgc",
			),
		),
	);
	sources.set("ward/2024-05-uk-bgc", source);
	writeFileSync(join(root, "data/source", source.input), "not JSON");
	assert.throws(
		() => new AreaGeometryCache(root, sources, 2, store),
		/Cannot use compiled geometry for ward\/2024-05-uk-bgc.*data:build --only geometry-store/,
	);
});

test("rejects invalid compiled metadata instead of reading the raw source", (t) => {
	const { root, sources, store } = gridRelease(t);
	mkdirSync(store);
	writeFileSync(
		join(store, compiledGeometryFile("ward", "2025-05-uk-bgc")),
		Buffer.alloc(64),
	);
	writeFileSync(
		join(root, "data/source", sources.get("ward/2025-05-uk-bgc")!.input),
		"not JSON",
	);
	assert.throws(
		() => new AreaGeometryCache(root, sources, 2, store),
		/not a compiled geometry release.*data:build --only geometry-store/,
	);
});

test("rechecks missing and stale stores after eviction without a source fallback", (t) => {
	const { root, sources, store } = gridRelease(t);
	mkdirSync(store);
	const source = sources.get("ward/2025-05-uk-bgc")!;
	const body = encodeGeometryStore(
		source,
		new AreaGeometryCache(root, sources).compile("ward", "2025-05-uk-bgc"),
	);
	sources.set("ward/2024-05-uk-bgc", source);
	const first = join(store, compiledGeometryFile("ward", "2025-05-uk-bgc"));
	writeFileSync(first, body);
	writeFileSync(
		join(store, compiledGeometryFile("ward", "2024-05-uk-bgc")),
		body,
	);
	const cache = new AreaGeometryCache(root, sources, 1, store);
	assert.deepEqual(cache.stats().loadedReleases, []);
	assert.equal(cache.stats().compiledLoads, 0);
	const expected = cache.get("ward", "2025-05-uk-bgc", "E05000001");
	assert.ok(expected);
	assert.deepEqual(
		cache.get("ward", "2024-05-uk-bgc", "E05000001"),
		expected,
	);
	writeFileSync(join(root, "data/source", source.input), "not JSON");
	rmSync(first);
	assert.throws(
		() => cache.get("ward", "2025-05-uk-bgc", "E05000001"),
		/ENOENT.*data:build --only geometry-store/,
	);
	writeFileSync(
		first,
		encodeGeometryStore({ ...source, inputHash: "sha256:old" }, []),
	);
	assert.throws(
		() => cache.get("ward", "2025-05-uk-bgc", "E05000001"),
		/does not match the registered source.*data:build --only geometry-store/,
	);
	assert.equal(cache.stats().staleCompiledLoads, 1);
	assert.equal(cache.stats().loads, 2);
	assert.deepEqual(cache.stats().loadedReleases, ["ward/2024-05-uk-bgc"]);
	writeFileSync(first, body);
	assert.deepEqual(
		cache.get("ward", "2025-05-uk-bgc", "E05000001"),
		expected,
	);
});

test("the API factory validates the store and serves without raw boundary files", (t) => {
	const { root, sources } = gridRelease(t);
	const apiRoot = join(root, "services", "api");
	const store = join(artifactRoot(apiRoot), "geometry-store");
	mkdirSync(store, { recursive: true });
	const source = sources.get("ward/2025-05-uk-bgc")!;
	writeFileSync(
		join(artifactRoot(apiRoot), "geometry-sources.json"),
		JSON.stringify({
			schemaVersion: 1,
			releases: [
				{ id: "ward/2025-05-uk-bgc", status: "available", ...source },
			],
		}),
	);
	assert.throws(
		() => createAreaGeometryCache(apiRoot),
		/Cannot use compiled geometry.*data:build --only geometry-store/,
	);
	const file = join(store, compiledGeometryFile("ward", "2025-05-uk-bgc"));
	writeFileSync(
		file,
		encodeGeometryStore(
			source,
			new AreaGeometryCache(root, sources).compile(
				"ward",
				"2025-05-uk-bgc",
			),
		),
	);
	rmSync(join(root, "data/source", source.input));
	const cache = createAreaGeometryCache(apiRoot);
	assert.deepEqual(cache.stats().loadedReleases, []);
	assert.ok(cache.get("ward", "2025-05-uk-bgc", "E05000001"));
	assert.equal(cache.stats().compiledLoads, 1);
});
