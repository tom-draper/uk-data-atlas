import type { GeoJsonGeometry } from "./areaGeometry";
import {
	containPoint,
	ringsOf,
	type Coordinate,
	type GeometryBounds,
} from "./areaContainment";

// WGS 84 ellipsoid.
const A = 6378137;
const F = 1 / 298.257223563;
const E2 = F * (2 - F);

/**
 * Metres per degree of longitude and of latitude at a latitude, from the
 * ellipsoid's radii of curvature there.
 */
export const metresPerDegree = (latitude: number) => {
	const sinLat = Math.sin((latitude * Math.PI) / 180);
	const w = Math.sqrt(1 - E2 * sinLat * sinLat);
	const meridional = (A * (1 - E2)) / (w * w * w);
	const primeVertical = (A / w) * Math.sqrt(1 - sinLat * sinLat);
	return {
		longitude: (primeVertical * Math.PI) / 180,
		latitude: (meridional * Math.PI) / 180,
	};
};

export const DISTANCE_METHOD =
	"Ground distance on the WGS 84 ellipsoid in a plane tangent at the point, scaled by the radii of curvature at its latitude. Within the 50 km a lookup reaches, this departs from the geodesic by less than a tenth of a percent.";

/** A point's position in metres east and north of an origin, in its tangent plane. */
const planar = (origin: Coordinate) => {
	const scale = metresPerDegree(origin[1]);
	return ([longitude, latitude]: Coordinate): [number, number] => [
		(longitude - origin[0]) * scale.longitude,
		(latitude - origin[1]) * scale.latitude,
	];
};

const segmentDistance = (
	[startX, startY]: [number, number],
	[endX, endY]: [number, number],
) => {
	const deltaX = endX - startX;
	const deltaY = endY - startY;
	const lengthSquared = deltaX * deltaX + deltaY * deltaY;
	const along =
		lengthSquared === 0
			? 0
			: Math.max(
					0,
					Math.min(
						1,
						-(startX * deltaX + startY * deltaY) / lengthSquared,
					),
				);
	return Math.hypot(startX + along * deltaX, startY + along * deltaY);
};

type BoundarySegment = {
	start: Coordinate;
	end: Coordinate;
	bounds: GeometryBounds;
};
type BoundaryIndex = {
	segments: BoundarySegment[];
	cells: Map<string, number[]>;
	longSegments: number[];
};

const boundaryIndexes = new Map<GeoJsonGeometry, BoundaryIndex>();
const MAX_BOUNDARY_INDEXES = 48;
const DISTANCE_CELL_DEGREES = 0.025;
const MAX_SEGMENT_CELLS = 64;

const boundaryIndexFor = (geometry: GeoJsonGeometry): BoundaryIndex => {
	const cached = boundaryIndexes.get(geometry);
	if (cached) {
		boundaryIndexes.delete(geometry);
		boundaryIndexes.set(geometry, cached);
		return cached;
	}
	const index: BoundaryIndex = {
		segments: [],
		cells: new Map(),
		longSegments: [],
	};
	for (const ring of ringsOf(geometry)) {
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const start = ring[j]!;
			const end = ring[i]!;
			const segmentIndex = index.segments.length;
			index.segments.push({
				start,
				end,
				bounds: [
					Math.min(start[0], end[0]),
					Math.min(start[1], end[1]),
					Math.max(start[0], end[0]),
					Math.max(start[1], end[1]),
				],
			});
			const west = Math.floor(
				Math.min(start[0], end[0]) / DISTANCE_CELL_DEGREES,
			);
			const east = Math.floor(
				Math.max(start[0], end[0]) / DISTANCE_CELL_DEGREES,
			);
			const south = Math.floor(
				Math.min(start[1], end[1]) / DISTANCE_CELL_DEGREES,
			);
			const north = Math.floor(
				Math.max(start[1], end[1]) / DISTANCE_CELL_DEGREES,
			);
			const cells = (east - west + 1) * (north - south + 1);
			if (cells > MAX_SEGMENT_CELLS) {
				index.longSegments.push(segmentIndex);
				continue;
			}
			for (let x = west; x <= east; x++)
				for (let y = south; y <= north; y++) {
					const key = `${x}/${y}`;
					const segments = index.cells.get(key) ?? [];
					segments.push(segmentIndex);
					index.cells.set(key, segments);
				}
		}
	}
	boundaryIndexes.set(geometry, index);
	if (boundaryIndexes.size > MAX_BOUNDARY_INDEXES)
		boundaryIndexes.delete(boundaryIndexes.keys().next().value!);
	return index;
};

/** Metres from a point to the nearest edge of any ring, holes included. */
export const distanceToBoundaryM = (
	point: Coordinate,
	geometry: GeoJsonGeometry,
): number => {
	const toPlane = planar(point);
	let nearest = Infinity;
	for (const ring of ringsOf(geometry)) {
		const projected = ring.map(toPlane);
		for (let i = 0, j = projected.length - 1; i < projected.length; j = i++)
			nearest = Math.min(
				nearest,
				segmentDistance(projected[j]!, projected[i]!),
			);
	}
	return nearest;
};

/**
 * `distanceToBoundaryM` for many points against one geometry. Each point is
 * measured to the same segments by the same tangent-plane arithmetic, so the
 * answers are the same numbers. Segments are filed in a grid of cells, and
 * the search visits rings of cells outward from the point's own, stopping
 * once the next ring lies further away than the nearest edge found.
 */
export const boundaryDistanceFinder = (geometry: GeoJsonGeometry) => {
	const starts: Coordinate[] = [];
	const ends: Coordinate[] = [];
	let west = Infinity;
	let south = Infinity;
	let east = -Infinity;
	let north = -Infinity;
	for (const ring of ringsOf(geometry))
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			starts.push(ring[j]!);
			ends.push(ring[i]!);
			west = Math.min(west, ring[i]![0]);
			east = Math.max(east, ring[i]![0]);
			south = Math.min(south, ring[i]![1]);
			north = Math.max(north, ring[i]![1]);
		}
	const count = starts.length;
	// Some four segments to a cell, on average, over the geometry's envelope.
	const cell = Math.max(
		Math.sqrt(((east - west) * (north - south) * 4) / Math.max(count, 1)),
		1e-4,
	);
	const columns = Math.floor((east - west) / cell) + 1;
	const rows = Math.floor((north - south) / cell) + 1;
	const cells = new Map<number, number[]>();
	for (let at = 0; at < count; at += 1) {
		const [x0, y0] = starts[at]!;
		const [x1, y1] = ends[at]!;
		for (
			let x = Math.floor((Math.min(x0, x1) - west) / cell);
			x <= Math.floor((Math.max(x0, x1) - west) / cell);
			x += 1
		)
			for (
				let y = Math.floor((Math.min(y0, y1) - south) / cell);
				y <= Math.floor((Math.max(y0, y1) - south) / cell);
				y += 1
			) {
				const key = x * rows + y;
				const members = cells.get(key);
				if (members) members.push(at);
				else cells.set(key, [at]);
			}
	}
	const seen = new Int32Array(count);
	let query = 0;
	return (point: Coordinate): number => {
		if (count === 0) return Infinity;
		query += 1;
		const toPlane = planar(point);
		const scale = metresPerDegree(point[1]);
		const cellM = cell * Math.min(scale.longitude, scale.latitude);
		const px = Math.floor((point[0] - west) / cell);
		const py = Math.floor((point[1] - south) / cell);
		// How far outside the grid the point lies, in cells, before any ring
		// can reach a segment.
		const outside = Math.max(
			0,
			-px,
			px - (columns - 1),
			-py,
			py - (rows - 1),
		);
		const widest = outside + Math.max(columns, rows);
		let nearest = Infinity;
		const visit = (x: number, y: number) => {
			if (x < 0 || y < 0 || x >= columns || y >= rows) return;
			// A cell whose rectangle lies beyond the nearest edge holds
			// nothing nearer.
			const gapX = Math.max(
				0,
				west + x * cell - point[0],
				point[0] - (west + (x + 1) * cell),
			);
			const gapY = Math.max(
				0,
				south + y * cell - point[1],
				point[1] - (south + (y + 1) * cell),
			);
			if (
				Math.hypot(gapX * scale.longitude, gapY * scale.latitude) >
				nearest + 1e-6
			)
				return;
			for (const at of cells.get(x * rows + y) ?? []) {
				if (seen[at] === query) continue;
				seen[at] = query;
				nearest = Math.min(
					nearest,
					segmentDistance(toPlane(starts[at]!), toPlane(ends[at]!)),
				);
			}
		};
		for (let ring = 0; ring <= widest; ring += 1) {
			// Every cell of this ring or beyond lies at least ring - 1 whole
			// cells from the point.
			if ((ring - 1) * cellM > nearest + 1e-6) break;
			if (ring === 0) {
				visit(px, py);
				continue;
			}
			for (let x = px - ring; x <= px + ring; x += 1) {
				visit(x, py - ring);
				visit(x, py + ring);
			}
			for (let y = py - ring + 1; y <= py + ring - 1; y += 1) {
				visit(px - ring, y);
				visit(px + ring, y);
			}
		}
		return nearest;
	};
};

/**
 * Metres from a point to the nearest edge of a geometry, when some edge is
 * within `withinM`; undefined otherwise. Edges whose bounding box is further
 * than that are skipped without projecting them, so checking many points
 * against a detailed boundary stays cheap.
 */
export const boundaryDistanceWithinM = (
	point: Coordinate,
	geometry: GeoJsonGeometry,
	withinM: number,
): number | undefined => {
	const scale = metresPerDegree(point[1]);
	const reachX = withinM / scale.longitude;
	const reachY = withinM / scale.latitude;
	const toPlane = planar(point);
	let nearest: number | undefined;
	const index = boundaryIndexFor(geometry);
	const west = Math.floor((point[0] - reachX) / DISTANCE_CELL_DEGREES);
	const east = Math.floor((point[0] + reachX) / DISTANCE_CELL_DEGREES);
	const south = Math.floor((point[1] - reachY) / DISTANCE_CELL_DEGREES);
	const north = Math.floor((point[1] + reachY) / DISTANCE_CELL_DEGREES);
	const candidateCount = (east - west + 1) * (north - south + 1);
	const candidates = new Set(index.longSegments);
	if (candidateCount <= 5_000) {
		for (let x = west; x <= east; x++)
			for (let y = south; y <= north; y++)
				for (const segment of index.cells.get(`${x}/${y}`) ?? [])
					candidates.add(segment);
	} else {
		for (let segment = 0; segment < index.segments.length; segment++)
			candidates.add(segment);
	}
	for (const segmentIndex of candidates) {
		const segment = index.segments[segmentIndex]!;
		const [minX, minY, maxX, maxY] = segment.bounds;
		if (
			minX > point[0] + reachX ||
			maxX < point[0] - reachX ||
			minY > point[1] + reachY ||
			maxY < point[1] - reachY
		)
			continue;
		const distance = segmentDistance(
			toPlane(segment.start),
			toPlane(segment.end),
		);
		if (
			distance <= withinM &&
			(nearest === undefined || distance < nearest)
		)
			nearest = distance;
	}
	return nearest;
};

/** Metres from a point to an area: zero when the point is on or inside it. */
export const distanceToGeometryM = (
	point: Coordinate,
	geometry: GeoJsonGeometry,
): number =>
	containPoint(point, geometry) === "outside"
		? distanceToBoundaryM(point, geometry)
		: 0;

/**
 * Metres from a point to the nearest part of a bounding box, in the same
 * tangent plane: never more than the distance to anything inside it, so it
 * rules areas out without walking their rings.
 */
export const distanceToBoundsM = (
	point: Coordinate,
	bounds: GeometryBounds,
): number => {
	const scale = metresPerDegree(point[1]);
	return Math.hypot(
		Math.max(bounds[0] - point[0], 0, point[0] - bounds[2]) *
			scale.longitude,
		Math.max(bounds[1] - point[1], 0, point[1] - bounds[3]) *
			scale.latitude,
	);
};
