import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { GeometrySourceLookup } from "@uk-data-atlas/atlas-runtime/geometry";
import {
	RawGeometryCache,
	readGeometries,
} from "@uk-data-atlas/atlas-runtime/areas";

const fixture = (
	run: (root: string, sources: GeometrySourceLookup) => void,
) => {
	const root = mkdtempSync(join(tmpdir(), "crosswalk-geometry-cache-"));
	mkdirSync(join(root, "data/source"), { recursive: true });
	const sources: GeometrySourceLookup = new Map();
	for (const release of ["a", "b", "c"]) {
		const input = `${release}.geojson`;
		sources.set(`ward/${release}`, {
			input,
			crs: "EPSG:4326",
			codeProperty: "CODE",
		});
		writeFileSync(
			join(root, "data/source", input),
			JSON.stringify({
				type: "FeatureCollection",
				features: ["S1", "S2"].map((code, index) => ({
					type: "Feature",
					properties: { CODE: code },
					geometry: {
						type: "Polygon",
						coordinates: [
							[
								[index, 0],
								[index + 0.01, 0],
								[index + 0.01, 0.01],
								[index, 0.01],
								[index, 0],
							],
						],
					},
				})),
			}),
		);
	}
	try {
		run(root, sources);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};
const endpoint = (boundaryRelease: string) => ({
	geography: "ward" as const,
	boundaryRelease,
});

test("reuses decoded geometry and provenance without reading the source again", () =>
	fixture((root, sources) => {
		const cache = new RawGeometryCache();
		const expected = readGeometries(root, "first", endpoint("a"), sources);
		const first = cache.read(root, "first", endpoint("a"), sources);
		assert.deepEqual(first, expected);
		rmSync(join(root, "data/source/a.geojson"));
		assert.equal(cache.read(root, "second", endpoint("a"), sources), first);
		assert.deepEqual(cache.stats(), {
			hits: 1,
			loads: 1,
			releases: 1,
			vertices: 10,
		});
	}));

test("separates filtered releases and source registry snapshots", () =>
	fixture((root, sources) => {
		const cache = new RawGeometryCache();
		const read = (pattern?: RegExp) =>
			cache.read(root, "filtered", endpoint("a"), sources, pattern);
		assert.deepEqual([...read(/^S1$/).geometries.keys()], ["S1"]);
		assert.deepEqual([...read(/^S2$/).geometries.keys()], ["S2"]);
		assert.deepEqual([...read().geometries.keys()], ["S1", "S2"]);
		const changed = new Map(sources);
		changed.set("ward/a", {
			input: "c.geojson",
			crs: "EPSG:4326",
			codeProperty: "CODE",
		});
		assert.equal(
			cache.read(root, "changed", endpoint("a"), changed).provenance
				.input,
			"c.geojson",
		);
		assert.equal(cache.stats().loads, 4);
	}));

test("evicts least recently used releases and respects the coordinate budget", () =>
	fixture((root, sources) => {
		const cache = new RawGeometryCache(2, 20);
		const read = (release: string) =>
			cache.read(root, "eviction", endpoint(release), sources);
		read("a");
		read("b");
		read("a");
		read("c");
		read("b");
		assert.deepEqual(cache.stats(), {
			hits: 1,
			loads: 4,
			releases: 2,
			vertices: 20,
		});
		const bounded = new RawGeometryCache(10, 10);
		bounded.read(root, "bounded", endpoint("a"), sources);
		bounded.read(root, "bounded", endpoint("b"), sources);
		assert.equal(bounded.stats().releases, 1);
		const oversized = new RawGeometryCache(2, 9);
		oversized.read(root, "oversized", endpoint("a"), sources);
		oversized.read(root, "oversized", endpoint("a"), sources);
		assert.deepEqual(oversized.stats(), {
			hits: 0,
			loads: 2,
			releases: 0,
			vertices: 0,
		});
	}));

test("a new build does not reuse an earlier build's cached source", () =>
	fixture((root, sources) => {
		new RawGeometryCache().read(root, "first", endpoint("a"), sources);
		rmSync(join(root, "data/source/a.geojson"));
		assert.throws(
			() =>
				new RawGeometryCache().read(
					root,
					"second",
					endpoint("a"),
					sources,
				),
			/ENOENT/,
		);
	}));
