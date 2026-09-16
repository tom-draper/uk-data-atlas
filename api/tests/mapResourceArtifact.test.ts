import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import type { MapResourceDescriptor } from "../src/mapResource/compileMapResource";
import { tileId, TILE_TYPE_MVT } from "../src/mapResource/pmtiles";
import { MAX_ZOOM, MIN_ZOOM, ZOOM_TIERS } from "../src/mapResource/tileset";
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
