import type { Pair } from "polygon-clipping";
import { projectEqualArea } from "../areaOverlap";
import type { Coordinate } from "../areaContainment";
import { GEOMETRY_TIERS, type GeometryTier } from "../simplifyGeometry";
import { rebuildAreas, rebuildRing, type Topology } from "./arcs";
import type { GeoJsonGeometry } from "../areaGeometry";

/**
 * Generalise a decomposed release one arc at a time.
 *
 * Every area that references an arc gets the identical simplified coordinates,
 * because there is only one copy to simplify. Two areas either share an arc
 * exactly or do not share it at all, at every tier, which is the guarantee a
 * map needs and the one `simplifyGeometry` cannot give.
 */

const triangleAreaM2 = (a: Pair, b: Pair, c: Pair) =>
	Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;

/**
 * Visvalingam-Whyatt over one arc: drop the vertex whose triangle with its
 * neighbours is smallest until the smallest left exceeds the threshold.
 * Removing a vertex enlarges its neighbours' triangles, so theirs are measured
 * again and pushed again; an entry that no longer matches the area recorded
 * for its vertex is stale and skipped.
 *
 * An open arc keeps both ends, because they are junctions another arc also
 * ends at, and moving one would tear the two apart. A closed arc has no
 * junction to keep and is simplified around, never below a triangle.
 */
const simplifyArc = (
	arc: Coordinate[],
	closed: boolean,
	thresholdM2: number,
): Coordinate[] => {
	const floor = closed ? 3 : 2;
	if (arc.length <= floor) return arc;
	const count = arc.length;
	const projected = arc.map((coordinate) =>
		projectEqualArea(coordinate as Pair),
	);
	const previous = new Int32Array(count);
	const next = new Int32Array(count);
	const area = new Float64Array(count);
	const removed = new Uint8Array(count);
	for (let i = 0; i < count; i += 1) {
		previous[i] = (i - 1 + count) % count;
		next[i] = (i + 1) % count;
	}
	const areaAt = (i: number) =>
		triangleAreaM2(
			projected[previous[i]!]!,
			projected[i]!,
			projected[next[i]!]!,
		);
	// An open arc's ends are fixed, so they are never measured or offered.
	const movable = (i: number) => closed || (i !== 0 && i !== count - 1);
	for (let i = 0; i < count; i += 1)
		area[i] = movable(i) ? areaAt(i) : Infinity;

	const heap: [number, number][] = [];
	const swim = (start: number) => {
		let child = start;
		while (child > 0) {
			const parent = (child - 1) >> 1;
			if (heap[parent]![0] <= heap[child]![0]) break;
			[heap[parent], heap[child]] = [heap[child]!, heap[parent]!];
			child = parent;
		}
	};
	const sink = () => {
		let parent = 0;
		for (;;) {
			const left = parent * 2 + 1;
			if (left >= heap.length) break;
			const right = left + 1;
			const child =
				right < heap.length && heap[right]![0] < heap[left]![0]
					? right
					: left;
			if (heap[parent]![0] <= heap[child]![0]) break;
			[heap[parent], heap[child]] = [heap[child]!, heap[parent]!];
			parent = child;
		}
	};
	const push = (entry: [number, number]) => {
		heap.push(entry);
		swim(heap.length - 1);
	};
	const pop = () => {
		const top = heap[0]!;
		const last = heap.pop()!;
		if (heap.length > 0) {
			heap[0] = last;
			sink();
		}
		return top;
	};
	for (let i = 0; i < count; i += 1) if (movable(i)) push([area[i]!, i]);

	let remaining = count;
	while (heap.length > 0 && remaining > floor) {
		const [entryArea, vertex] = pop();
		if (removed[vertex] || entryArea !== area[vertex]) continue;
		if (entryArea >= thresholdM2) break;
		removed[vertex] = 1;
		remaining -= 1;
		const before = previous[vertex]!;
		const after = next[vertex]!;
		next[before] = after;
		previous[after] = before;
		for (const neighbour of [before, after]) {
			if (removed[neighbour] || !movable(neighbour)) continue;
			area[neighbour] = areaAt(neighbour);
			push([area[neighbour]!, neighbour]);
		}
	}
	return arc.filter((_, i) => !removed[i]);
};

export type TierGeometry = {
	tier: GeometryTier;
	toleranceM: number;
	minEffectiveAreaM2: number;
	areas: Map<string, GeoJsonGeometry>;
	arcs: Coordinate[][];
	verticesBefore: number;
	verticesAfter: number;
	/**
	 * Arcs given back some detail because a ring built from them enclosed
	 * nothing at the tier's own threshold. A high count says the tier is too
	 * coarse for this release; zero says the tier held everywhere.
	 */
	refinedArcs: number;
};

/** How far a threshold is cut each time a ring turns out to need more detail. */
const REFINEMENT_STEP = 8;

/**
 * One tier of a decomposed release: every arc generalised once, areas rebuilt.
 *
 * A ring made of two or three arcs can collapse when each is cut back to the
 * junctions at its ends: the ring is still there, but it encloses nothing and
 * is no longer drawable. Rather than drop the part, which would take an island
 * off the map without saying so, the arcs of a collapsed ring are simplified
 * again at a finer threshold until the ring encloses something. They are still
 * simplified once each, so every area referencing a refined arc gets the same
 * refinement and borders stay shared.
 */
export const compileTier = (
	topology: Topology,
	tier: GeometryTier,
): TierGeometry => {
	const toleranceM = GEOMETRY_TIERS[tier];
	const minEffectiveAreaM2 = toleranceM * toleranceM;
	const verticesBefore = topology.arcs.reduce(
		(total, arc) => total + arc.length,
		0,
	);
	if (toleranceM === 0)
		return {
			tier,
			toleranceM,
			minEffectiveAreaM2,
			areas: rebuildAreas(topology, topology.arcs),
			arcs: topology.arcs,
			verticesBefore,
			verticesAfter: verticesBefore,
			refinedArcs: 0,
		};

	const thresholds = new Float64Array(topology.arcs.length).fill(
		minEffectiveAreaM2,
	);
	const refined = new Uint8Array(topology.arcs.length);
	const simplify = (index: number) =>
		simplifyArc(
			topology.arcs[index]!,
			topology.closed[index]!,
			thresholds[index]!,
		);
	const arcs = topology.arcs.map((_, index) => simplify(index));

	// A ring encloses nothing until it has three distinct coordinates and a
	// repeat of the first.
	const collapsed = () =>
		[...topology.areas.values()].flatMap((polygons) =>
			polygons.flatMap((polygon) =>
				polygon.filter((ring) => rebuildRing(ring, arcs).length < 4),
			),
		);
	for (let pass = 0; ; pass += 1) {
		const rings = collapsed();
		if (rings.length === 0) break;
		let cut = false;
		for (const ring of rings) {
			for (const { arc } of ring) {
				if (thresholds[arc] === 0) continue;
				thresholds[arc] = Math.floor(
					thresholds[arc]! / REFINEMENT_STEP,
				);
				refined[arc] = 1;
				arcs[arc] = simplify(arc);
				cut = true;
			}
		}
		// Every arc of every collapsed ring is already at its full detail, so
		// the ring is degenerate in the source and no threshold will save it.
		if (!cut) break;
		/* c8 ignore next 5 */
		if (pass > 64)
			throw new Error(
				"Refining collapsed rings did not settle; the decomposition is inconsistent.",
			);
	}

	return {
		tier,
		toleranceM,
		minEffectiveAreaM2,
		areas: rebuildAreas(topology, arcs),
		arcs,
		verticesBefore,
		verticesAfter: arcs.reduce((total, arc) => total + arc.length, 0),
		refinedArcs: refined.reduce<number>((total, flag) => total + flag, 0),
	};
};

/**
 * Sent with a map resource, so a drawing carries the terms it was made on.
 * The last line is the limit worth stating plainly: sharing a border is not
 * the same as staying a valid polygon everywhere.
 */
export const TOPOLOGY_METHOD = {
	rule: "Visvalingam-Whyatt over shared arcs. The release is split into arcs at every junction where the pair of areas a boundary separates changes, each arc is simplified once, and every area is rebuilt from the simplified arcs.",
	threshold:
		"A tier is the side of the smallest square of detail kept, and its threshold is that square's area, measured in the EPSG:6933 equal-area projection. It bounds the size of feature dropped, not the distance any vertex moves.",
	sharedBorders:
		"A border between two areas is one arc, simplified once, so both areas carry identical coordinates along it at every tier. Neighbours cannot crack apart or diverge, however coarse the tier.",
	junctions:
		"A vertex where the boundary changes which pair of areas it separates is kept at every tier. Three areas that meet at a point still meet at that point.",
	parts: "No part is dropped. An arc is never reduced below the two coordinates that connect its junctions, or the three that enclose a ring, and where a ring built from those would enclose nothing its arcs are simplified again at a finer threshold until it does. A small island stays on the map as a coarse shape rather than disappearing from it.",
	validity:
		"Arcs are simplified independently of each other. Shared borders stay shared, but a generalised arc can cross another arc it does not touch, so a coarse tier is not guaranteed to be a topologically valid coverage.",
} as const;
