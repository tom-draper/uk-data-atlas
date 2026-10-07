import assert from "node:assert/strict";
import test from "node:test";
import type { Coordinate } from "../src/areaContainment";
import {
	clipRing,
	clipWorldRing,
	tilesCovering,
	toTileGrid,
	toWorldRing,
	worldTile,
} from "../src/mapResource/tileGrid";

/**
 * clipWorldRing is clipRing made fast enough to tile a coastline, and is only
 * correct if it is clipRing: the same points, in the same order, for every
 * ring in every tile. These rings wander in and out of tiles, along their
 * edges and back across them, which is where skipping vertices could go wrong.
 */

/** A small deterministic generator, so a failure can be reproduced. */
const random = (seed: number) => () => {
	seed = (seed * 1664525 + 1013904223) % 2 ** 32;
	return seed / 2 ** 32;
};

/** A closed ring that random-walks around a point, like a ragged coastline. */
const wanderingRing = (
	next: () => number,
	[longitude, latitude]: Coordinate,
	vertices: number,
	step: number,
): Coordinate[] => {
	const ring: Coordinate[] = [];
	for (let index = 0; index < vertices; index += 1) {
		const angle = (index / vertices) * 2 * Math.PI;
		const reach = step * (20 + next() * 40);
		ring.push([
			longitude + Math.cos(angle) * reach + (next() - 0.5) * step,
			latitude + Math.sin(angle) * reach * 0.6 + (next() - 0.5) * step,
		]);
	}
	return [...ring, ring[0]!];
};

test("clips a projected ring exactly as clipRing does, in every tile", () => {
	const next = random(7);
	let compared = 0;
	let nonEmpty = 0;
	for (let sample = 0; sample < 12; sample += 1) {
		const centre: Coordinate = [-3 + next(), 54 + next()];
		const step = 0.002 * 2 ** (sample % 4);
		const closed = wanderingRing(next, centre, 50 + sample * 90, step);
		for (const ring of [closed, closed.slice(0, -1)]) {
			const projected = toWorldRing(ring);
			for (const z of [6, 9, 12]) {
				const [west, north] = [centre[0] - 1, centre[1] + 1];
				const [east, south] = [centre[0] + 1, centre[1] - 1];
				for (const address of tilesCovering(
					[west, south, east, north],
					z,
				).filter((_, index) => index % 7 === 0)) {
					const expected = clipRing(
						ring.map((coordinate) =>
							toTileGrid(coordinate, address),
						),
					);
					assert.deepEqual(
						clipWorldRing(projected, address),
						expected,
						`sample ${sample} at ${address.z}/${address.x}/${address.y}`,
					);
					compared += 1;
					if (expected.length > 0) nonEmpty += 1;
				}
			}
		}
	}
	assert.ok(
		nonEmpty > 50,
		"enough tiles hold part of a ring to mean something",
	);
	assert.ok(compared > nonEmpty * 2, "and enough miss them altogether");
});

test("places a coordinate in a tile as worldTile does at the tile's zoom", () => {
	const coordinate: Coordinate = [-1.2345678, 52.3456789];
	for (const z of [0, 5, 12]) {
		const [worldX, worldY] = worldTile(coordinate, z);
		const address = { z, x: Math.floor(worldX), y: Math.floor(worldY) };
		assert.deepEqual(toTileGrid(coordinate, address), [
			Math.round((worldX - address.x) * 4096),
			Math.round((worldY - address.y) * 4096),
		]);
	}
});
