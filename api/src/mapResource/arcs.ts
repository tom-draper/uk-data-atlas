import type { Coordinate } from "../areaContainment";
import type { GeoJsonGeometry } from "../areaGeometry";

/**
 * A boundary release decomposed into shared arcs, so a border between two
 * areas exists once rather than twice.
 *
 * Generalising an area on its own redraws every border it has, including the
 * ones its neighbours also draw, and the two sides then disagree by up to the
 * tolerance. Simplifying an arc instead changes both areas that reference it
 * by exactly the same amount, so a shared border stays shared however far it
 * is generalised. That is a property of the decomposition, not of the
 * tolerance, which is what makes it testable.
 *
 * This works because adjacent areas in one published release are drawn from
 * the same vertices, the same fact `areaNeighbours` relies on to measure a
 * shared border without a distance threshold. No coordinate is snapped or
 * rounded here; arcs are found by exact equality or not at all.
 */

/** A ring's use of one arc, reversed when the ring runs against its stored direction. */
export type ArcRef = { arc: number; reversed: boolean };

/** One polygon: its outer ring first, then any holes. Each ring is a list of arcs. */
export type PolygonArcs = ArcRef[][];

export type Topology = {
	/**
	 * Every distinct arc, as coordinates. An arc that divides two areas runs
	 * between the junctions at its ends; an arc no junction divides, such as
	 * an island's coast, is the whole ring and is stored without repeating its
	 * first coordinate.
	 */
	arcs: Coordinate[][];
	/** True where the arc is a whole ring rather than a run between junctions. */
	closed: boolean[];
	/** Each area's polygons, by area code. */
	areas: Map<string, PolygonArcs[]>;
	/**
	 * Edges found on more than two areas. A coverage should have none: an edge
	 * belongs to one area on each side of it. They are counted rather than
	 * refused here, so the caller decides whether the release is fit to tile.
	 */
	overlappingEdges: number;
};

/** Vertices are numbered, and an edge keyed by its two numbers; this bounds how many. */
const EDGE_SHIFT = 2 ** 24;

const polygonsOf = (geometry: GeoJsonGeometry): Coordinate[][][] => {
	if (geometry.type === "GeometryCollection")
		return (geometry.geometries ?? []).flatMap(polygonsOf);
	const polygons =
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.type === "MultiPolygon"
				? geometry.coordinates
				: [];
	if (!Array.isArray(polygons)) return [];
	return polygons.flatMap((polygon) =>
		Array.isArray(polygon)
			? [
					polygon.flatMap((ring) =>
						Array.isArray(ring) ? [ring as Coordinate[]] : [],
					),
				]
			: [],
	);
};

/**
 * Split a boundary release into arcs.
 *
 * A vertex ends an arc when the boundary cannot continue through it
 * unambiguously: either more or fewer than two edges meet there, or the edges
 * that meet there do not separate the same pair of areas. The second case is
 * the one that matters — it is exactly the point where a border between two
 * areas becomes a border between two others, and an arc that ran through it
 * would belong to neither pair.
 */
export const decomposeArcs = (
	areas: Map<string, GeoJsonGeometry>,
): Topology => {
	const vertexIds = new Map<string, number>();
	const vertices: Coordinate[] = [];
	const idOf = (coordinate: Coordinate) => {
		const key = `${coordinate[0]},${coordinate[1]}`;
		let id = vertexIds.get(key);
		if (id === undefined) {
			id = vertices.length;
			vertices.push(coordinate);
			vertexIds.set(key, id);
		}
		return id;
	};

	// Rings as vertex numbers, without the repeated closing coordinate, so a
	// ring is a plain cycle from here on.
	const codes = [...areas.keys()];
	const ringsByArea = codes.map((code) =>
		polygonsOf(areas.get(code)!).map((polygon) =>
			polygon.map((ring) => {
				const ids = ring.map(idOf);
				while (ids.length > 1 && ids[0] === ids[ids.length - 1]!)
					ids.pop();
				return ids;
			}),
		),
	);
	if (vertices.length >= EDGE_SHIFT)
		throw new Error(
			`A release of ${vertices.length} distinct vertices is too large to decompose; the limit is ${EDGE_SHIFT}.`,
		);

	const edgeIds = new Map<number, number>();
	const edgeStart: number[] = [];
	const edgeEnd: number[] = [];
	const firstOwner: number[] = [];
	const secondOwner: number[] = [];
	let overlappingEdges = 0;
	for (const [area, polygons] of ringsByArea.entries()) {
		for (const polygon of polygons) {
			for (const ring of polygon) {
				for (let i = 0; i < ring.length; i += 1) {
					const from = ring[i]!;
					const to = ring[(i + 1) % ring.length]!;
					if (from === to) continue;
					const [low, high] = from < to ? [from, to] : [to, from];
					const key = low * EDGE_SHIFT + high;
					let edge = edgeIds.get(key);
					if (edge === undefined) {
						edge = edgeStart.length;
						edgeIds.set(key, edge);
						edgeStart.push(low);
						edgeEnd.push(high);
						firstOwner.push(area);
						secondOwner.push(-1);
						continue;
					}
					if (firstOwner[edge] === area || secondOwner[edge] === area)
						continue;
					if (secondOwner[edge] === -1) secondOwner[edge] = area;
					else overlappingEdges += 1;
				}
			}
		}
	}

	// Which pair of areas an edge separates, as one number, and then whether
	// every edge at a vertex separates the same pair.
	const degree = new Int32Array(vertices.length);
	const separates = new Float64Array(vertices.length).fill(-1);
	const mixed = new Uint8Array(vertices.length);
	for (let edge = 0; edge < edgeStart.length; edge += 1) {
		const pair =
			firstOwner[edge]! * (codes.length + 1) + secondOwner[edge]!;
		for (const vertex of [edgeStart[edge]!, edgeEnd[edge]!]) {
			degree[vertex] += 1;
			if (separates[vertex] === -1) separates[vertex] = pair;
			else if (separates[vertex] !== pair) mixed[vertex] = 1;
		}
	}
	const isJunction = (vertex: number) =>
		degree[vertex] !== 2 || mixed[vertex] === 1;

	const arcs: Coordinate[][] = [];
	const closed: boolean[] = [];
	const arcIds = new Map<string, number>();
	const store = (sequence: number[], isClosed: boolean, key: string) => {
		let id = arcIds.get(key);
		if (id === undefined) {
			id = arcs.length;
			arcs.push(sequence.map((vertex) => vertices[vertex]!));
			closed.push(isClosed);
			arcIds.set(key, id);
		}
		return id;
	};

	/** An arc between two junctions, stored in whichever direction sorts first. */
	const openArc = (sequence: number[]): ArcRef => {
		const forward = sequence.join(",");
		const backward = [...sequence].reverse().join(",");
		if (forward <= backward)
			return { arc: store(sequence, false, forward), reversed: false };
		return {
			arc: store([...sequence].reverse(), false, backward),
			reversed: true,
		};
	};

	/**
	 * A ring no junction divides, such as an island or a hole that is exactly
	 * one other area. Two areas can reach it from different coordinates and in
	 * either direction, so it is keyed from its lowest-numbered vertex. A ring
	 * is the same ring whichever of its points is written first, so only the
	 * direction is recorded.
	 */
	const closedArc = (ring: number[]): ArcRef => {
		let lowest = 0;
		for (let i = 1; i < ring.length; i += 1)
			if (ring[i]! < ring[lowest]!) lowest = i;
		const forward = [
			...ring.slice(lowest),
			...ring.slice(0, lowest),
		] as number[];
		const backward = [forward[0]!, ...forward.slice(1).reverse()];
		const forwardKey = forward.join(",");
		const backwardKey = backward.join(",");
		if (forwardKey <= backwardKey)
			return { arc: store(forward, true, forwardKey), reversed: false };
		return {
			arc: store(backward, true, backwardKey),
			reversed: true,
		};
	};

	const ringArcs = (ring: number[]): ArcRef[] => {
		if (ring.length === 0) return [];
		const junctions = ring.flatMap((vertex, index) =>
			isJunction(vertex) ? [index] : [],
		);
		if (junctions.length === 0) return [closedArc(ring)];
		return junctions.map((start, index) => {
			const end = junctions[(index + 1) % junctions.length]!;
			const sequence = [ring[start]!];
			let at = start;
			do {
				at = (at + 1) % ring.length;
				sequence.push(ring[at]!);
			} while (at !== end);
			return openArc(sequence);
		});
	};

	return {
		arcs,
		closed,
		areas: new Map(
			codes.map((code, area) => [
				code,
				ringsByArea[area]!.map((polygon) => polygon.map(ringArcs)),
			]),
		),
		overlappingEdges,
	};
};

/** Put a ring back together from its arcs, closing it as GeoJSON requires. */
export const rebuildRing = (
	refs: ArcRef[],
	arcs: Coordinate[][],
): Coordinate[] => {
	const ring: Coordinate[] = [];
	for (const { arc, reversed } of refs) {
		const stored = arcs[arc]!;
		const run = reversed ? [...stored].reverse() : stored;
		// Consecutive arcs meet at a junction that both of them carry.
		for (let i = ring.length === 0 ? 0 : 1; i < run.length; i += 1)
			ring.push(run[i]!);
	}
	const first = ring[0];
	const last = ring[ring.length - 1];
	if (first && last && (first[0] !== last[0] || first[1] !== last[1]))
		ring.push(first);
	return ring;
};

/** Every area rebuilt from the given arcs, which may have been generalised. */
export const rebuildAreas = (
	topology: Topology,
	arcs: Coordinate[][],
): Map<string, GeoJsonGeometry> =>
	new Map(
		[...topology.areas].flatMap(([code, polygons]) => {
			const rebuilt = polygons.flatMap((polygon) => {
				const rings = polygon
					.map((ring) => rebuildRing(ring, arcs))
					// A ring needs three distinct corners and a repeat of the
					// first to enclose anything.
					.filter((ring) => ring.length >= 4);
				return rings.length === 0 ? [] : [rings];
			});
			if (rebuilt.length === 0) return [];
			return [
				[
					code,
					rebuilt.length === 1
						? { type: "Polygon", coordinates: rebuilt[0]! }
						: { type: "MultiPolygon", coordinates: rebuilt },
				] as const,
			];
		}),
	);
