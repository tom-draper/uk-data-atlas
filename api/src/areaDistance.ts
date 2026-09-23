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
	for (const ring of ringsOf(geometry))
		for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
			const [startX, startY] = ring[j]!;
			const [endX, endY] = ring[i]!;
			if (
				Math.min(startX, endX) > point[0] + reachX ||
				Math.max(startX, endX) < point[0] - reachX ||
				Math.min(startY, endY) > point[1] + reachY ||
				Math.max(startY, endY) < point[1] - reachY
			)
				continue;
			const distance = segmentDistance(
				toPlane(ring[j]!),
				toPlane(ring[i]!),
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
