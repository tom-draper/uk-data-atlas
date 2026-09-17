import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { MapResourceDescriptor } from "../src/mapResource/compileMapResource";
import { tileId, TILE_TYPE_MVT } from "../src/mapResource/pmtiles";
import { MAX_ZOOM, MIN_ZOOM, ZOOM_TIERS } from "../src/mapResource/tileset";
import { featureIds } from "../src/mapResource/compileMapResource";
import { GEOMETRY_TIERS } from "../src/simplifyGeometry";
import { readParquet } from "./parquetFixtures";
import { readHeader, readMetadata, readTile } from "./pmtilesFixtures";
import { decodeTile } from "./vectorTileFixtures";

/**
 * The published artifact, held to the descriptor that describes it.
 *
 * A descriptor whose hashes no longer match the archive beside it is worse
 * than none: it is the thing a client cites to prove a drawing came from a
 * stated release. Everything here is read from `public/` exactly as a client
 * would read it, so a rebuild that is not committed fails rather than drifting.
 */

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = join(apiRoot, "public");

const manifest = JSON.parse(
	readFileSync(join(publicRoot, "map-resources.json"), "utf8"),
) as {
	schemaVersion: number;
	contentHash: string;
	resources: MapResourceDescriptor[];
};

const sha256 = (content: Buffer) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

test("recomputes the manifest's own content hash", () => {
	const { contentHash, ...withoutHash } = manifest;
	assert.equal(
		contentHash,
		`sha256:${createHash("sha256")
			.update(JSON.stringify(withoutHash))
			.digest("hex")}`,
		"the map resource manifest was edited without rebuilding it",
	);
	assert.ok(manifest.resources.length > 0);
});

test("matches every archive to the hash and size its descriptor gives", () => {
	for (const resource of manifest.resources) {
		const archive = readFileSync(join(publicRoot, resource.tiles.artifact));
		assert.equal(
			archive.length,
			resource.tiles.bytes,
			`${resource.id} is not the size its descriptor records`,
		);
		assert.equal(
			sha256(archive),
			resource.tiles.contentHash,
			`${resource.id} does not hash to what its descriptor records; rebuild with \`pnpm build:map-resource\``,
		);
	}
});

test("describes the archive the way the archive describes itself", () => {
	for (const resource of manifest.resources) {
		const archive = readFileSync(join(publicRoot, resource.tiles.artifact));
		const header = readHeader(archive);
		assert.equal(header.magic, "PMTiles");
		assert.equal(header.tileType, TILE_TYPE_MVT);
		assert.equal(header.minZoom, resource.tiles.minZoom);
		assert.equal(header.maxZoom, resource.tiles.maxZoom);
		assert.equal(header.addressedTiles, resource.tiles.tileCount);
		assert.equal(resource.tiles.minZoom, MIN_ZOOM);
		assert.equal(resource.tiles.maxZoom, MAX_ZOOM);
		// The descriptor's zoom table is the ladder the tiles were built from.
		assert.deepEqual(
			resource.tiles.zooms.map((band) => [
				band.minZoom,
				band.maxZoom,
				band.tier,
			]),
			ZOOM_TIERS.map((band) => [band.minZoom, band.maxZoom, band.tier]),
		);
		// A renderer that has only the archive still knows what it may say.
		const metadata = readMetadata(archive) as { attribution?: string };
		assert.equal(metadata.attribution, resource.attribution.text);
	}
});

test("names the publisher file the shapes were compiled from", () => {
	const sources = JSON.parse(
		readFileSync(join(publicRoot, "geometry-sources.json"), "utf8"),
	) as { releases: Array<{ id: string; input: string; inputHash?: string }> };
	for (const resource of manifest.resources) {
		const source = sources.releases.find(
			(entry) => entry.id === resource.id,
		);
		assert.ok(source, `${resource.id} has no geometry source`);
		assert.equal(resource.geometrySource.input, source!.input);
		assert.equal(resource.geometrySource.inputHash, source!.inputHash);
	}
});

test("carries a real name, not the code again, into the tiles", () => {
	for (const resource of manifest.resources) {
		const archive = readFileSync(join(publicRoot, resource.tiles.artifact));
		// Zoom 0 holds the whole release in one tile, so every area is in it.
		const tile = readTile(archive, tileId(0, 0, 0));
		assert.ok(tile, `${resource.id} has no zoom 0 tile`);
		const [layer] = decodeTile(tile!);
		assert.equal(layer!.name, resource.tiles.layer);
		assert.ok(layer!.features.length > 0);
		const ids = new Set<number>();
		let named = 0;
		for (const feature of layer!.features) {
			const code = feature.properties.code as string;
			const name = feature.properties.name as string;
			assert.ok(code, "a feature reached a tile with no code");
			assert.ok(name, `${code} reached a tile with no name`);
			if (name !== code) named += 1;
			assert.ok(!ids.has(feature.id), `feature id ${feature.id} repeats`);
			ids.add(feature.id);
		}
		assert.equal(
			named,
			layer!.features.length,
			`${resource.id} put codes in the name field`,
		);
	}
});

/** Every ring of a little-endian WKB polygon or multipolygon. */
const wkbRings = (wkb: Buffer) => {
	let at = 0;
	const u32 = () => {
		const value = wkb.readUInt32LE(at);
		at += 4;
		return value;
	};
	const polygon = () => {
		assert.equal(wkb[at], 1, "WKB is not little-endian");
		at += 1;
		assert.equal(u32(), 3, "expected a WKB polygon");
		return Array.from({ length: u32() }, () =>
			Array.from({ length: u32() }, () => {
				const point = [wkb.readDoubleLE(at), wkb.readDoubleLE(at + 8)];
				at += 16;
				return point as [number, number];
			}),
		);
	};
	assert.equal(wkb[0], 1);
	const type = wkb.readUInt32LE(1);
	let rings: Array<Array<[number, number]>>;
	if (type === 3) rings = polygon();
	else {
		assert.equal(type, 6, `WKB type ${type} is not a polygon or multipolygon`);
		at = 5;
		rings = Array.from({ length: u32() }, polygon).flat();
	}
	assert.equal(at, wkb.length, "WKB has bytes past its geometry");
	return rings;
};

test("publishes every tier as GeoParquet that matches its descriptor and the tiles", () => {
	for (const resource of manifest.resources) {
		assert.deepEqual(
			resource.features.map((entry) => entry.tier),
			Object.keys(GEOMETRY_TIERS),
		);
		const archive = readFileSync(join(publicRoot, resource.tiles.artifact));
		const [layer] = decodeTile(readTile(archive, tileId(0, 0, 0))!);
		const inTiles = new Map(
			layer!.features.map((feature) => [
				feature.properties.code as string,
				{ id: feature.id, name: feature.properties.name },
			]),
		);
		for (const entry of resource.features) {
			const bytes = readFileSync(join(publicRoot, entry.artifact));
			assert.equal(bytes.length, entry.bytes, `${entry.artifact} size`);
			assert.equal(
				sha256(bytes),
				entry.contentHash,
				`${entry.artifact} does not hash to what its descriptor records; rebuild with \`pnpm build:map-resource\``,
			);
			const file = readParquet(bytes);
			assert.equal(file.rowCount, entry.rowCount);
			assert.equal(file.rowCount, resource.areaCount);

			const geo = JSON.parse(file.metadata.geo!) as {
				version: string;
				primary_column: string;
				columns: Record<
					string,
					{
						encoding: string;
						geometry_types: string[];
						crs?: unknown;
						bbox: number[];
						covering: { bbox: Record<string, string[]> };
					}
				>;
			};
			assert.equal(geo.version, "1.1.0");
			assert.equal(geo.primary_column, "geometry");
			const column = geo.columns.geometry!;
			assert.equal(column.encoding, "WKB");
			// Left out, the CRS is OGC:CRS84, which is what the tiers are in.
			assert.equal(column.crs, undefined);
			assert.deepEqual(column.covering.bbox, {
				xmin: ["bbox", "xmin"],
				ymin: ["bbox", "ymin"],
				xmax: ["bbox", "xmax"],
				ymax: ["bbox", "ymax"],
			});
			const about = JSON.parse(file.metadata["uk-data-atlas"]!) as {
				tier: string;
				attribution: string;
			};
			assert.equal(about.tier, entry.tier);
			assert.equal(about.attribution, resource.attribution.text);

			// The ids a join table publishes, in order, and the tiles' names.
			const numbered = featureIds(
				file.rows.map((row) => row.code as string),
			);
			let matched = 0;
			const types = new Set<string>();
			const extent = [Infinity, Infinity, -Infinity, -Infinity];
			file.rows.forEach((row, index) => {
				const code = row.code as string;
				assert.equal(row.id, numbered.get(code));
				assert.equal(row.id, index + 1, "rows are not in id order");
				// An area smaller than a zoom 0 grid unit is not in that tile.
				if (inTiles.has(code)) {
					assert.deepEqual(
						{ id: row.id, name: row.name },
						inTiles.get(code),
						`${code} differs between the GeoParquet and the tiles`,
					);
					matched += 1;
				}
				const geometry = row.geometry as Buffer;
				types.add(geometry.readUInt32LE(1) === 3 ? "Polygon" : "MultiPolygon");
				const box = row.bbox as Record<string, number>;
				let points = 0;
				for (const ring of wkbRings(geometry)) {
					assert.ok(ring.length >= 4, `${code} has a ring enclosing nothing`);
					assert.deepEqual(ring[0], ring.at(-1), `${code} has an open ring`);
					for (const [x, y] of ring) {
						assert.ok(x >= box.xmin! && x <= box.xmax!, `${code} lies outside its bbox`);
						assert.ok(y >= box.ymin! && y <= box.ymax!, `${code} lies outside its bbox`);
						points += 1;
					}
				}
				assert.ok(points > 0);
				extent[0] = Math.min(extent[0]!, box.xmin!);
				extent[1] = Math.min(extent[1]!, box.ymin!);
				extent[2] = Math.max(extent[2]!, box.xmax!);
				extent[3] = Math.max(extent[3]!, box.ymax!);
			});
			assert.equal(matched, inTiles.size, "a tile area is missing from the GeoParquet");
			assert.deepEqual(column.geometry_types, [...types].sort());
			assert.deepEqual(column.bbox, extent);
		}
	}
});
