import assert from "node:assert/strict";
import test from "node:test";
import type { Coordinate } from "@uk-data-atlas/geography/geometry-point-containment";
import {
	clipRing,
	clipWorldRing,
	tilesCovering,
	toTileGrid,
	toWorldRing,
	worldTile,
} from "@uk-data-atlas/map-tiles/tileGrid";

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
			for (let z = 0; z <= 12; z += 1) {
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

test("clips long rings across hierarchy levels, closure and buffer boundaries", () => {
	const centre: Coordinate = [-3, 54];
	const closed = wanderingRing(random(19), centre, 8193, 0.01);
	for (const ring of [
		closed,
		closed.slice(0, -1),
		[...closed.slice(401), ...closed.slice(0, 401)],
	]) {
		const projected = toWorldRing(ring);
		for (const z of [6, 9, 12]) {
			const [worldX, worldY] = worldTile(centre, z);
			for (const offset of [-1, 0, 1]) {
				const address = {
					z,
					x: Math.floor(worldX) + offset,
					y: Math.floor(worldY),
				};
				for (const buffer of [0, 64, 257])
					assert.deepEqual(
						clipWorldRing(projected, address, buffer),
						clipRing(
							ring.map((point) => toTileGrid(point, address)),
							buffer,
						),
					);
			}
		}
	}
});

test("retains a ring inside the tile and rejects empty and distant rings", () => {
	const ring: Coordinate[] = [
		[-90, 0],
		[-45, 0],
		[-45, 40],
		[-90, 40],
		[-90, 0],
	];
	assert.deepEqual(clipWorldRing(toWorldRing(ring), { z: 0, x: 0, y: 0 }), [
		[1024, 2048],
		[1536, 2048],
		[1536, 1551],
		[1024, 1551],
	]);
	assert.deepEqual(
		clipWorldRing(toWorldRing([]), { z: 6, x: 31, y: 20 }),
		[],
	);
	assert.deepEqual(
		clipWorldRing(toWorldRing(ring), { z: 6, x: 31, y: 20 }),
		[],
	);
});

test("keeps the tile covered when all vertices lie outside it", () => {
	const address = { z: 6, x: 31, y: 20 };
	const corners: Coordinate[] = [
		[-512, -512],
		[4608, -512],
		[4608, 4608],
		[-512, 4608],
	];
	const ring: Coordinate[] = [];
	for (let side = 0; side < corners.length; side += 1) {
		const from = corners[side]!;
		const to = corners[(side + 1) % corners.length]!;
		for (let step = 0; step < 257; step += 1) {
			const x =
				(address.x +
					(from[0] + ((to[0] - from[0]) * step) / 257) / 4096) /
				64;
			const y =
				(address.y +
					(from[1] + ((to[1] - from[1]) * step) / 257) / 4096) /
				64;
			ring.push([
				x * 360 - 180,
				(Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
			]);
		}
	}
	ring.push(ring[0]!);
	assert.deepEqual(clipWorldRing(toWorldRing(ring), address), [
		[4160, -64],
		[4160, 4160],
		[-64, 4160],
		[-64, -64],
	]);
});
