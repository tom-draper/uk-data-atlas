import type { Pair } from "polygon-clipping";
import { edgeLengthM } from "./areaOverlap";
import type { GeoJsonGeometry } from "./areaGeometry";
import type { Coordinate } from "./areaContainment";

/**
 * How two areas meet. `edge` is a shared boundary with length; `point` is a
 * corner meeting a corner and nothing more, which is the case a caller usually
 * wants excluded: four areas meeting at a crossroads are not four neighbours
 * of each other in any sense useful for comparison or for colouring a map.
 */
export type Touch = "edge" | "point";

export type Neighbour = {
	code: string;
	touch: Touch;
	sharedBorderM: number;
	sharedEdges: number;
	sharedVertices: number;
};

/**
 * The boundary of one area, keyed for exact comparison with another's.
 *
 * Adjacent areas in one published release are drawn from the same vertices, so
 * a shared border is the same coordinates on both sides and matches exactly.
 * That is what makes this a measurement rather than a tolerance: no distance
 * threshold decides who is a neighbour.
 */
export type BorderIndex = {
	edges: Map<string, number>;
	vertices: Set<string>;
};

const vertexKey = ([longitude, latitude]: Coordinate) =>
	`${longitude},${latitude}`;

const edgeKey = (start: Coordinate, end: Coordinate) => {
	const from = vertexKey(start);
	const to = vertexKey(end);
	return from < to ? `${from}|${to}` : `${to}|${from}`;
};

const ringsOf = (geometry: GeoJsonGeometry): Coordinate[][] => {
	if (geometry.type === "GeometryCollection")
		return (geometry.geometries ?? []).flatMap(ringsOf);
	const polygons =
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.type === "MultiPolygon"
				? geometry.coordinates
				: [];
	return (Array.isArray(polygons) ? polygons : []).flatMap((polygon) =>
		(Array.isArray(polygon) ? polygon : []).flatMap((ring) =>
			Array.isArray(ring) ? [ring as Coordinate[]] : [],
		),
	);
};

/** Every edge and vertex of an area's boundary, with each edge's length. */
export const borderIndex = (geometry: GeoJsonGeometry): BorderIndex => {
	const edges = new Map<string, number>();
	const vertices = new Set<string>();
	for (const ring of ringsOf(geometry)) {
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const start = ring[j]!;
			const end = ring[i]!;
			if (!Array.isArray(start) || !Array.isArray(end)) continue;
			vertices.add(vertexKey(start));
			// A closed ring repeats its first point, and the wrap-around pairs
			// that repeat with the original. Left in, that zero-length edge
			// would key on a single vertex, and two areas meeting at nothing
			// but that vertex would read as sharing a border.
			if (vertexKey(start) === vertexKey(end)) continue;
			const key = edgeKey(start, end);
			if (!edges.has(key))
				edges.set(key, edgeLengthM(start as Pair, end as Pair));
		}
	}
	return { edges, vertices };
};

/**
 * How one area's boundary meets another's. Returns undefined when they do not
 * meet at all, so a caller can tell "not a neighbour" from "a neighbour with
 * nothing in common", which cannot happen.
 *
 * An edge counted once on each side is one shared border, so length is summed
 * over the distinct shared edges rather than over both areas' copies of them.
 */
export const sharedBorder = (
	target: BorderIndex,
	other: BorderIndex,
): Omit<Neighbour, "code"> | undefined => {
	let sharedEdges = 0;
	let sharedBorderM = 0;
	// Walk the smaller of the two, since the answer is symmetric.
	const [small, large] =
		other.edges.size < target.edges.size
			? [other.edges, target.edges]
			: [target.edges, other.edges];
	for (const [key, length] of small) {
		if (!large.has(key)) continue;
		sharedEdges += 1;
		sharedBorderM += length;
	}
	let sharedVertices = 0;
	const [smallVertices, largeVertices] =
		other.vertices.size < target.vertices.size
			? [other.vertices, target.vertices]
			: [target.vertices, other.vertices];
	for (const key of smallVertices) {
		if (largeVertices.has(key)) sharedVertices += 1;
	}
	if (sharedVertices === 0) return undefined;
	return {
		touch: sharedEdges > 0 ? "edge" : "point",
		sharedBorderM,
		sharedEdges,
		sharedVertices,
	};
};
