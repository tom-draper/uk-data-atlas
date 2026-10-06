import { areaMetrics } from "./areaMetrics";
import type { AreaIdentity } from "./resolver/areas";
import type { RouteRequest } from "./routing";
import { problem, type ApiResponse } from "./routeResponse";

/**
 * Travels with every measurement, so a figure taken from one response can be
 * read without the documentation beside it. The last line is the one that
 * matters: this is the boundary as published, not a land-area statistic.
 */
const AREA_METRIC_METHOD = {
	area: "Ellipsoidal, through EPSG:6933 (WGS 84 / NSIDC EASE-Grid 2.0 Global), a Lambert cylindrical equal-area projection on the WGS 84 ellipsoid. Projected area equals area on the ellipsoid, so no correction is applied. Holes are subtracted.",
	perimeter:
		"Summed over every ring, holes included. Each edge's ground length comes from the ellipsoid's meridional and prime-vertical radii of curvature at its mid-latitude.",
	centroid:
		"The centre of area, taken in the same equal-area projection so each part weighs its true ground area, then inverted to WGS 84. It can fall outside a crescent or a split area.",
	labelPoint:
		"A point guaranteed inside the area. The centroid where that lies within the geometry, otherwise the midpoint of the widest run of interior found on latitudes sampled across the bounding box.",
	caveat: "Measured from the boundary as that release publishes it, at its own generalisation. This is not a published land-area statistic: a coastline-clipped boundary still encloses inland water, so these figures differ from the ONS Standard Area Measurement used by population density.",
} as const;

/**
 * Measurements of one area's published boundary, as `include=metrics`
 * expands it: area, perimeter, centroid and a label point.
 */
export const areaGeometryMetrics = (
	context: RouteRequest["context"],
	identity: AreaIdentity,
): { metrics: Record<string, unknown> } | { response: ApiResponse } => {
	const geographyResolver = context.geographyResolver;
	const unavailable = geographyResolver.requires("geometry");
	if (unavailable) return { response: unavailable };
	try {
		const resolved = geographyResolver.areaGeometry(identity);
		if (!resolved)
			return {
				response: problem(
					404,
					"Not Found",
					"No raw geometry matches that area identity.",
				),
			};
		const metrics = areaMetrics(resolved.geometry);
		if (!metrics)
			return {
				response: problem(
					422,
					"Geometry Not Measurable",
					"That area's geometry carries no polygon to measure.",
				),
			};
		return {
			metrics: {
				boundingBox: metrics.boundingBox,
				centroid: metrics.centroid,
				labelPoint: metrics.labelPoint,
				labelPointMethod: metrics.labelPointMethod,
				area: {
					m2: metrics.areaM2,
					hectares: metrics.areaHectares,
					km2: metrics.areaKm2,
				},
				perimeter: {
					m: metrics.perimeterM,
					km: metrics.perimeterKm,
				},
				geometryExtent: {
					parts: metrics.parts,
					rings: metrics.rings,
					vertices: metrics.vertices,
				},
				method: AREA_METRIC_METHOD,
				geometrySource: resolved.geometrySource,
			},
		};
	} catch (error) {
		return {
			response: problem(
				503,
				"Geometry Unavailable",
				error instanceof Error
					? error.message
					: "Geometry could not be loaded.",
			),
		};
	}
};
