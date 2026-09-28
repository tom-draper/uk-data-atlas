import polygonClipping, { type MultiPolygon } from "polygon-clipping";
import type { AreaGeometryCache, GeoJsonGeometry } from "./areaGeometry";
import { geometryBounds, type GeometryBounds } from "./areaContainment";

export type NamedLocationGeometry = {
	boundaryRelease: string;
	bbox: GeometryBounds;
	geometry: GeoJsonGeometry;
};

const multiPolygon = (geometry: GeoJsonGeometry): MultiPolygon[] =>
	geometry.type === "Polygon"
		? [[geometry.coordinates] as unknown as MultiPolygon]
		: geometry.type === "MultiPolygon"
			? [geometry.coordinates as MultiPolygon]
			: geometry.type === "GeometryCollection"
				? (geometry.geometries ?? []).flatMap(multiPolygon)
				: [];

/** Union a location's declared members once during compilation, in WGS84. */
export const compileNamedLocationGeometry = (
	cache: AreaGeometryCache,
	geography: string,
	boundaryRelease: string,
	codes: string[],
): NamedLocationGeometry | undefined => {
	const parts = codes.flatMap((code) => {
		const geometry = cache.get(geography, boundaryRelease, code);
		return geometry ? multiPolygon(geometry) : [];
	});
	if (parts.length === 0) return undefined;
	const [first, ...rest] = parts;
	if (!first) return undefined;
	const coordinates = polygonClipping.union(first, ...rest);
	const geometry: GeoJsonGeometry = { type: "MultiPolygon", coordinates };
	const bbox = geometryBounds(geometry);
	return bbox ? { boundaryRelease, bbox, geometry } : undefined;
};
