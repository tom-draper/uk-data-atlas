import type { GeoJsonGeometry } from "./areaGeometry";

export type Coordinate = [longitude: number, latitude: number];
export type GeometryBounds = [
	minLongitude: number,
	minLatitude: number,
	maxLongitude: number,
	maxLatitude: number,
];
export type PointContainment = "interior" | "boundary" | "outside";

const EPSILON = 1e-12;

const isCoordinate = (value: unknown): value is Coordinate =>
	Array.isArray(value) &&
	value.length >= 2 &&
	typeof value[0] === "number" &&
	Number.isFinite(value[0]) &&
	typeof value[1] === "number" &&
	Number.isFinite(value[1]);

const coordinatesOf = (value: unknown): Coordinate[] => {
	if (isCoordinate(value)) return [[value[0], value[1]]];
	return Array.isArray(value) ? value.flatMap(coordinatesOf) : [];
};

export const geometryBounds = (
	geometry: GeoJsonGeometry,
): GeometryBounds | undefined => {
	const coordinates =
		geometry.type === "GeometryCollection"
			? (geometry.geometries ?? []).flatMap((part) => {
					const bounds = geometryBounds(part);
					return bounds ? [bounds] : [];
				})
			: coordinatesOf(geometry.coordinates).map(
					([longitude, latitude]) =>
						[
							longitude,
							latitude,
							longitude,
							latitude,
						] as GeometryBounds,
				);
	if (coordinates.length === 0) return undefined;
	return coordinates.reduce<GeometryBounds>(
		(bounds, [minLongitude, minLatitude, maxLongitude, maxLatitude]) => [
			Math.min(bounds[0], minLongitude),
			Math.min(bounds[1], minLatitude),
			Math.max(bounds[2], maxLongitude),
			Math.max(bounds[3], maxLatitude),
		],
		[Infinity, Infinity, -Infinity, -Infinity],
	);
};

export const pointInBounds = (point: Coordinate, bounds: GeometryBounds) =>
	point[0] >= bounds[0] - EPSILON &&
	point[0] <= bounds[2] + EPSILON &&
	point[1] >= bounds[1] - EPSILON &&
	point[1] <= bounds[3] + EPSILON;

const pointOnSegment = (
	point: Coordinate,
	start: Coordinate,
	end: Coordinate,
) => {
	const [longitude, latitude] = point;
	const [startLongitude, startLatitude] = start;
	const [endLongitude, endLatitude] = end;
	const cross =
		(longitude - startLongitude) * (endLatitude - startLatitude) -
		(latitude - startLatitude) * (endLongitude - startLongitude);
	if (Math.abs(cross) > EPSILON) return false;
	return (
		longitude >= Math.min(startLongitude, endLongitude) - EPSILON &&
		longitude <= Math.max(startLongitude, endLongitude) + EPSILON &&
		latitude >= Math.min(startLatitude, endLatitude) - EPSILON &&
		latitude <= Math.max(startLatitude, endLatitude) + EPSILON
	);
};

const pointInRing = (point: Coordinate, ring: unknown): PointContainment => {
	if (!Array.isArray(ring)) return "outside";
	const coordinates = ring.filter(isCoordinate);
	if (coordinates.length < 3) return "outside";
	let inside = false;
	for (
		let index = 0, previous = coordinates.length - 1;
		index < coordinates.length;
		previous = index++
	) {
		const start = coordinates[previous] as Coordinate;
		const end = coordinates[index] as Coordinate;
		if (pointOnSegment(point, start, end)) return "boundary";
		const crossesLatitude = start[1] > point[1] !== end[1] > point[1];
		if (
			crossesLatitude &&
			point[0] <
				((end[0] - start[0]) * (point[1] - start[1])) /
					(end[1] - start[1]) +
					start[0]
		) {
			inside = !inside;
		}
	}
	return inside ? "interior" : "outside";
};

const pointInPolygon = (
	point: Coordinate,
	polygon: unknown,
): PointContainment => {
	if (!Array.isArray(polygon) || polygon.length === 0) return "outside";
	const outer = pointInRing(point, polygon[0]);
	if (outer === "outside") return "outside";
	for (const hole of polygon.slice(1)) {
		const containment = pointInRing(point, hole);
		if (containment === "boundary") return "boundary";
		if (containment === "interior") return "outside";
	}
	return outer;
};

const strongest = (left: PointContainment, right: PointContainment) =>
	left === "interior" || right === "interior"
		? "interior"
		: left === "boundary" || right === "boundary"
			? "boundary"
			: "outside";

/**
 * The API considers a point on an exterior or hole ring to belong to the area
 * and labels it `boundary`. This avoids arbitrary exclusion at shared borders;
 * callers receive every matching area at a shared edge.
 */
export const containPoint = (
	point: Coordinate,
	geometry: GeoJsonGeometry,
): PointContainment => {
	if (geometry.type === "Polygon")
		return pointInPolygon(point, geometry.coordinates);
	if (geometry.type === "MultiPolygon") {
		return (
			Array.isArray(geometry.coordinates) ? geometry.coordinates : []
		).reduce(
			(status, polygon) =>
				strongest(status, pointInPolygon(point, polygon)),
			"outside" as PointContainment,
		);
	}
	if (geometry.type === "GeometryCollection") {
		return (geometry.geometries ?? []).reduce(
			(status, part) => strongest(status, containPoint(point, part)),
			"outside" as PointContainment,
		);
	}
	return "outside";
};

export const boundsIntersect = (left: GeometryBounds, right: GeometryBounds) =>
	left[0] <= right[2] + EPSILON &&
	right[0] <= left[2] + EPSILON &&
	left[1] <= right[3] + EPSILON &&
	right[1] <= left[3] + EPSILON;

/** Every corner of `inner` lies within `outer`. */
export const boundsWithin = (inner: GeometryBounds, outer: GeometryBounds) =>
	inner[0] >= outer[0] - EPSILON &&
	inner[1] >= outer[1] - EPSILON &&
	inner[2] <= outer[2] + EPSILON &&
	inner[3] <= outer[3] + EPSILON;

/**
 * Liang-Barsky: does any part of the segment fall inside the rectangle? The
 * parametric range of the segment is clipped against each of the four edges in
 * turn, and survives only where the two meet.
 */
const segmentMeetsBounds = (
	[startLongitude, startLatitude]: Coordinate,
	[endLongitude, endLatitude]: Coordinate,
	bounds: GeometryBounds,
) => {
	const deltaLongitude = endLongitude - startLongitude;
	const deltaLatitude = endLatitude - startLatitude;
	let enter = 0;
	let leave = 1;
	const clip = (edge: number, distance: number) => {
		// Parallel to this edge: inside it, or nowhere near it.
		if (edge === 0) return distance >= -EPSILON;
		const crossing = distance / edge;
		if (edge < 0) {
			if (crossing > leave) return false;
			if (crossing > enter) enter = crossing;
		} else {
			if (crossing < enter) return false;
			if (crossing < leave) leave = crossing;
		}
		return true;
	};
	return (
		clip(-deltaLongitude, startLongitude - bounds[0]) &&
		clip(deltaLongitude, bounds[2] - startLongitude) &&
		clip(-deltaLatitude, startLatitude - bounds[1]) &&
		clip(deltaLatitude, bounds[3] - startLatitude)
	);
};

export const ringsOf = (geometry: GeoJsonGeometry): Coordinate[][] => {
	if (geometry.type === "GeometryCollection")
		return (geometry.geometries ?? []).flatMap(ringsOf);
	const polygons =
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.type === "MultiPolygon"
				? geometry.coordinates
				: [];
	return (Array.isArray(polygons) ? polygons : []).flatMap((polygon) =>
		(Array.isArray(polygon) ? polygon : []).map((ring) =>
			coordinatesOf(ring),
		),
	);
};

/**
 * Does the geometry meet the rectangle at all? Exact, not a bounding-box
 * approximation.
 *
 * Either some edge of the geometry passes through the rectangle, or none does
 * and the rectangle lies wholly inside or wholly outside, which one corner
 * settles. Testing that corner against the geometry rather than against an
 * outer ring is what keeps a rectangle sitting in a lake out of the answer.
 */
export const geometryMeetsBounds = (
	geometry: GeoJsonGeometry,
	bounds: GeometryBounds,
): boolean => {
	for (const ring of ringsOf(geometry)) {
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			if (segmentMeetsBounds(ring[j]!, ring[i]!, bounds)) return true;
		}
	}
	return containPoint([bounds[0], bounds[1]], geometry) !== "outside";
};
