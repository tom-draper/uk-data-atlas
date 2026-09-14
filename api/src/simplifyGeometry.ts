import type { Pair, Polygon } from "polygon-clipping";
import { polygonAreaM2, projectEqualArea } from "./areaOverlap";
import type { GeoJsonGeometry } from "./areaGeometry";

/**
 * Named generalisation tiers, each the side in metres of the smallest square
 * of detail kept. A tier's real threshold is that square's area, because the
 * rule below discards a vertex by how much area it contributes, not by how far
 * it lies from a line.
 *
 * The distinction matters at the ends: a spike survives between close
 * neighbours and goes between distant ones, since the same deviation spans a
 * larger triangle the further apart its neighbours sit. So a tier bounds the
 * size of feature dropped, and is not a promise that no vertex moves further
 * than its tolerance.
 */
export const GEOMETRY_TIERS = {
	full: 0,
	high: 10,
	medium: 100,
	low: 1000,
} as const;

export type GeometryTier = keyof typeof GEOMETRY_TIERS;

export const isGeometryTier = (value: string): value is GeometryTier =>
	Object.prototype.hasOwnProperty.call(GEOMETRY_TIERS, value);

export type SimplifyResult = {
	geometry: GeoJsonGeometry;
	tier: GeometryTier;
	toleranceM: number;
	/** The tier's actual threshold: a vertex goes if its triangle is smaller. */
	minEffectiveAreaM2: number;
	verticesBefore: number;
	verticesAfter: number;
	partsBefore: number;
	partsAfter: number;
};

const triangleAreaM2 = (a: Pair, b: Pair, c: Pair) =>
	Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;

/**
 * Visvalingam-Whyatt: repeatedly drop the vertex whose triangle with its two
 * neighbours is smallest, until the smallest remaining exceeds the threshold.
 * Removing a point enlarges its neighbours' triangles, so their areas are
 * recomputed and pushed again; a stale entry is recognised on pop by no longer
 * matching the area currently recorded for that vertex.
 *
 * Areas are taken in the equal-area projection, so the threshold is in real
 * square metres wherever in the country the ring lies. Rings never fall below
 * a closed triangle.
 */
const simplifyRing = (ring: Pair[], thresholdM2: number): Pair[] => {
	const isClosed =
		ring.length > 3 &&
		ring[0]![0] === ring[ring.length - 1]![0] &&
		ring[0]![1] === ring[ring.length - 1]![1];
	const points = isClosed ? ring.slice(0, -1) : ring.slice();
	const count = points.length;
	if (count <= 3) return ring;

	const projected = points.map(projectEqualArea);
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
	for (let i = 0; i < count; i += 1) area[i] = areaAt(i);

	// Binary min-heap of [area, vertex], smallest first.
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
	for (let i = 0; i < count; i += 1) push([area[i]!, i]);

	let remaining = count;
	while (heap.length > 0 && remaining > 3) {
		const [entryArea, vertex] = pop();
		// Stale: this vertex has gone, or its triangle has since been redrawn.
		if (removed[vertex] || entryArea !== area[vertex]) continue;
		if (entryArea >= thresholdM2) break;
		removed[vertex] = 1;
		remaining -= 1;
		const before = previous[vertex]!;
		const after = next[vertex]!;
		next[before] = after;
		previous[after] = before;
		for (const neighbour of [before, after]) {
			if (removed[neighbour]) continue;
			area[neighbour] = areaAt(neighbour);
			push([area[neighbour]!, neighbour]);
		}
	}

	const kept = points.filter((_, i) => !removed[i]);
	return isClosed ? [...kept, kept[0]!] : kept;
};

const simplifyPolygon = (
	polygon: Polygon,
	thresholdM2: number,
): Polygon | undefined => {
	const [outer, ...holes] = polygon;
	if (!outer) return undefined;
	// A part smaller than the detail being discarded is itself that detail:
	// an islet below the threshold goes, rather than surviving as a triangle.
	if (thresholdM2 > 0 && polygonAreaM2([outer]) < thresholdM2)
		return undefined;
	const simplifiedOuter = simplifyRing(outer, thresholdM2);
	if (simplifiedOuter.length < 4) return undefined;
	const simplifiedHoles = holes.flatMap((hole) => {
		if (thresholdM2 > 0 && polygonAreaM2([hole]) < thresholdM2) return [];
		const simplified = simplifyRing(hole, thresholdM2);
		return simplified.length < 4 ? [] : [simplified];
	});
	return [simplifiedOuter, ...simplifiedHoles];
};

const countVertices = (geometry: GeoJsonGeometry): number => {
	if (geometry.type === "GeometryCollection")
		return (geometry.geometries ?? []).reduce(
			(total, part) => total + countVertices(part),
			0,
		);
	const walk = (value: unknown): number =>
		Array.isArray(value)
			? typeof value[0] === "number"
				? 1
				: value.reduce<number>((total, item) => total + walk(item), 0)
			: 0;
	return walk(geometry.coordinates);
};

const countParts = (geometry: GeoJsonGeometry): number => {
	if (geometry.type === "GeometryCollection")
		return (geometry.geometries ?? []).reduce(
			(total, part) => total + countParts(part),
			0,
		);
	if (geometry.type === "Polygon") return 1;
	if (geometry.type === "MultiPolygon")
		return (geometry.coordinates as unknown[]).length;
	return 0;
};

const asPolygons = (geometry: GeoJsonGeometry): Polygon[] | undefined => {
	const rings =
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.type === "MultiPolygon"
				? geometry.coordinates
				: undefined;
	if (!Array.isArray(rings)) return undefined;
	return (rings as number[][][][]).map((polygon) =>
		polygon.map((ring) => ring.map(([x, y]) => [x, y] as Pair)),
	);
};

const simplifyGeometryTo = (
	geometry: GeoJsonGeometry,
	thresholdM2: number,
): GeoJsonGeometry | undefined => {
	if (geometry.type === "GeometryCollection") {
		const parts = (geometry.geometries ?? []).flatMap((part) => {
			const simplified = simplifyGeometryTo(part, thresholdM2);
			return simplified ? [simplified] : [];
		});
		return parts.length === 0
			? undefined
			: { type: "GeometryCollection", geometries: parts };
	}
	const polygons = asPolygons(geometry);
	// Anything that is not a polygon, such as a point source, is left alone.
	if (!polygons) return geometry;
	const simplified = polygons.flatMap((polygon) => {
		const result = simplifyPolygon(polygon, thresholdM2);
		return result ? [result] : [];
	});
	if (simplified.length === 0) return undefined;
	return geometry.type === "Polygon" && simplified.length === 1
		? { type: "Polygon", coordinates: simplified[0]! }
		: { type: "MultiPolygon", coordinates: simplified };
};

/**
 * The geometry generalised to a named tier, with what that cost.
 *
 * Each area is simplified on its own, from its own vertices. Neighbours are
 * not simplified together, so above `full` a shared border can be drawn
 * slightly differently on each side of it, by up to the tier's tolerance.
 * That is invisible on one area and matters when several are drawn together.
 *
 * Returns undefined only when every part of the geometry falls below the
 * tier's threshold, which a caller should read as "too small to draw at this
 * tier" rather than as missing geometry.
 */
export const simplifyGeometry = (
	geometry: GeoJsonGeometry,
	tier: GeometryTier,
): SimplifyResult | undefined => {
	const toleranceM = GEOMETRY_TIERS[tier];
	const verticesBefore = countVertices(geometry);
	const partsBefore = countParts(geometry);
	if (toleranceM === 0) {
		return {
			geometry,
			tier,
			toleranceM,
			minEffectiveAreaM2: 0,
			verticesBefore,
			verticesAfter: verticesBefore,
			partsBefore,
			partsAfter: partsBefore,
		};
	}
	const simplified = simplifyGeometryTo(geometry, toleranceM * toleranceM);
	if (!simplified) return undefined;
	return {
		geometry: simplified,
		tier,
		toleranceM,
		minEffectiveAreaM2: toleranceM * toleranceM,
		verticesBefore,
		verticesAfter: countVertices(simplified),
		partsBefore,
		partsAfter: countParts(simplified),
	};
};
