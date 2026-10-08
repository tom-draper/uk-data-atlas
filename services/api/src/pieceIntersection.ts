import { createRequire } from "node:module";
import polygonClipping, {
	type MultiPolygon,
	type Pair,
	type Polygon,
	type Ring,
} from "polygon-clipping";
import type { Bounds } from "./areaGeometryPieces";

export const CLIPPING_VERSION = (
	createRequire(import.meta.url)("polygon-clipping/package.json") as {
		version: string;
	}
).version;

// Wider than any generalised boundary's edges, so no edge that bounds an
// intersection is cut where a clipped polygon is trimmed.
const CLIP_MARGIN_DEGREES = 0.01;

/** Sutherland-Hodgman: the part of a ring on the kept side of one edge. */
const clipRing = (
	ring: Ring,
	inside: (point: Pair) => boolean,
	crossing: (from: Pair, to: Pair) => Pair,
): Ring => {
	const clipped: Ring = [];
	for (let index = 0; index < ring.length; index += 1) {
		const point = ring[index]!;
		const previous = ring[(index + ring.length - 1) % ring.length]!;
		if (inside(point)) {
			if (!inside(previous)) clipped.push(crossing(previous, point));
			clipped.push(point);
		} else if (inside(previous)) clipped.push(crossing(previous, point));
	}
	return clipped;
};

/**
 * The part of a polygon within a box. Two areas meet only within both their
 * envelopes, so each is trimmed to that shared box, with a margin, before
 * the costly intersection: two neighbours are then compared along their
 * shared border rather than in full. A trimmed ring may run back along the
 * box's edge, which the clipper reads as enclosing nothing.
 */
const clipToBounds = (
	polygon: Polygon,
	[west, south, east, north]: Bounds,
): Polygon | undefined => {
	const at = (from: Pair, to: Pair, share: number): Pair => [
		from[0] + (to[0] - from[0]) * share,
		from[1] + (to[1] - from[1]) * share,
	];
	const edges: Array<[(point: Pair) => boolean, (a: Pair, b: Pair) => Pair]> =
		[
			[
				([x]) => x >= west,
				(a, b) => at(a, b, (west - a[0]) / (b[0] - a[0])),
			],
			[
				([x]) => x <= east,
				(a, b) => at(a, b, (east - a[0]) / (b[0] - a[0])),
			],
			[
				([, y]) => y >= south,
				(a, b) => at(a, b, (south - a[1]) / (b[1] - a[1])),
			],
			[
				([, y]) => y <= north,
				(a, b) => at(a, b, (north - a[1]) / (b[1] - a[1])),
			],
		];
	const clip = (ring: Ring) =>
		edges.reduce(
			(current, [inside, crossing]) =>
				current.length === 0
					? current
					: clipRing(current, inside, crossing),
			ring,
		);
	// An outer ring wholly outside the box takes its holes with it.
	const [outer, ...holes] = polygon.map(clip);
	if (!outer || outer.length < 3) return undefined;
	return [outer, ...holes.filter((hole) => hole.length >= 3)];
};

/** Two pieces' intersection, each trimmed to where the other could be. */
export const intersectWithin = (
	left: { geometry: Polygon; bounds: Bounds },
	right: { geometry: Polygon; bounds: Bounds },
): MultiPolygon => {
	const box: Bounds = [
		Math.max(left.bounds[0], right.bounds[0]) - CLIP_MARGIN_DEGREES,
		Math.max(left.bounds[1], right.bounds[1]) - CLIP_MARGIN_DEGREES,
		Math.min(left.bounds[2], right.bounds[2]) + CLIP_MARGIN_DEGREES,
		Math.min(left.bounds[3], right.bounds[3]) + CLIP_MARGIN_DEGREES,
	];
	const leftClipped = clipToBounds(left.geometry, box);
	const rightClipped = clipToBounds(right.geometry, box);
	return leftClipped && rightClipped
		? polygonClipping.intersection(leftClipped, rightClipped)
		: [];
};
